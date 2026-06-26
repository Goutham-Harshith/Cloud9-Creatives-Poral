import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, type Order, type OrderDesign } from '@prisma/client';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { extname, join } from 'node:path';

import { PrismaService } from '../prisma/prisma.service';

type DashboardOrderStatus = 'Ready to pick' | 'In progress' | 'Complete';
const DEFAULT_DAILY_JUTE_CAPACITY = 160;
const SETTINGS_ID = 'app_settings';

export interface UploadedOrderFile {
  fieldname: string;
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

interface IncomingOrder {
  bag: {
    fabric: string;
    quantity: number | null;
    dueDate: string;
    productionStartDate: string;
    includeSunday: boolean;
    width: number | null;
    height: number | null;
    gusset: number | null;
    zip: string;
    color: string;
    handle: string;
    print: string;
    notes?: string | null;
  };
  designs: Array<{
    fileName: string;
    notes: string;
    uploadedFile?: StoredDesign['uploadedFile'];
  }>;
  customer: {
    name: string;
    phone: string;
    alternatePhone: string;
    address: string;
    courierType: string;
    courierNotes: string;
  };
}

export interface StoredDesign {
  fileName: string | null;
  notes: string | null;
  uploadedFile: {
    originalName: string;
    storedName: string;
    mimeType: string;
    size: number;
    path: string;
    url: string;
  } | null;
}

export interface StoredOrder {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  createdAt: string;
  bag: IncomingOrder['bag'];
  customer: IncomingOrder['customer'];
  designs: StoredDesign[];
}

type OrderWithDesigns = Order & { designs: OrderDesign[] };

@Injectable()
export class OrdersService {
  private readonly uploadsRoot = join(process.cwd(), 'uploads', 'orders');

  constructor(private readonly prisma: PrismaService) {}

  async create(rawOrder: string, files: UploadedOrderFile[]): Promise<StoredOrder> {
    const order = this.parseOrder(rawOrder);
    const id = `ord_${randomUUID()}`;
    const fileByDesignIndex = this.mapFilesByDesignIndex(files);
    const orderNumber = await this.createNextOrderNumber();

    const designs = await this.storeDesigns(order, id, fileByDesignIndex);
    const capacityReservations = await this.planCapacityReservations(order);
    const createdOrder = await this.prisma.order.create({
      data: {
        id,
        orderNumber,
        status: OrderStatus.ORDER_CREATED,
        ...this.toOrderData(order),
        designs: {
          create: designs.map((design, index) => this.toDesignData(design, index)),
        },
        capacityReservations: {
          create: capacityReservations,
        },
      },
      include: {
        designs: {
          orderBy: {
            sortOrder: 'asc',
          },
        },
        capacityReservations: true,
      },
    });

    return this.toStoredOrder(createdOrder);
  }

  async update(id: string, rawOrder: string, files: UploadedOrderFile[]): Promise<StoredOrder> {
    const order = this.parseOrder(rawOrder);
    const existingOrder = await this.prisma.order.findUnique({
      where: {
        id,
      },
    });

    if (!existingOrder) {
      throw new NotFoundException('Order not found.');
    }

    const fileByDesignIndex = this.mapFilesByDesignIndex(files);

    const designs = await this.storeDesigns(order, id, fileByDesignIndex);
    const capacityReservations = await this.planCapacityReservations(order, id);
    const updatedOrder = await this.prisma.$transaction(async (prisma) => {
      await prisma.orderDesign.deleteMany({
        where: {
          orderId: id,
        },
      });

      return prisma.order.update({
        where: {
          id,
        },
        data: {
          status: OrderStatus.ORDER_CREATED,
          ...this.toOrderData(order),
          designs: {
            create: designs.map((design, index) => this.toDesignData(design, index)),
          },
          capacityReservations: {
            deleteMany: {},
            create: capacityReservations,
          },
        },
        include: {
          designs: {
            orderBy: {
              sortOrder: 'asc',
            },
          },
        },
      });
    });

    return this.toStoredOrder(updatedOrder);
  }

  async findAllForDashboard() {
    const orders = await this.prisma.order.findMany({
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      type: order.fabric,
      quantity: order.quantity ?? null,
      size: `${order.width ?? 0}w x ${order.height ?? 0}h x ${order.gusset ?? 0}g`,
      updatedDate: order.updatedAt.toISOString(),
      status: this.toDashboardStatus(order.status),
      dueDate: order.dueDate,
    }));
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: {
        id,
      },
      include: {
        designs: {
          orderBy: {
            sortOrder: 'asc',
          },
        },
        capacityReservations: {
          orderBy: {
            productionDate: 'asc',
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found.');
    }

    return {
      ...this.toStoredOrder(order),
      status: this.toDashboardStatus(order.status),
      updatedDate: order.updatedAt.toISOString(),
    };
  }

  async findCapacityReservations(from?: string, to?: string) {
    const dailyCapacity = await this.getDailyJuteCapacity();
    const reservations = await this.prisma.orderCapacityReservation.findMany({
      where: {
        productionDate: {
          ...(from ? { gte: from } : {}),
          ...(to ? { lte: to } : {}),
        },
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            customerName: true,
            fabric: true,
          },
        },
      },
      orderBy: {
        productionDate: 'asc',
      },
    });

    return {
      dailyCapacity,
      reservations: reservations.map((reservation) => ({
        id: reservation.id,
        date: reservation.productionDate,
        quantity: reservation.quantity,
        order: {
          id: reservation.order.id,
          orderNumber: reservation.order.orderNumber,
          customer: reservation.order.customerName,
          fabric: reservation.order.fabric,
        },
      })),
    };
  }

  async updateStatus(id: string, dashboardStatus: string) {
    const status = this.toStoredStatus(dashboardStatus);

    try {
      const updatedOrder = await this.prisma.order.update({
        where: {
          id,
        },
        data: {
          status,
        },
      });

      return {
        id: updatedOrder.id,
        orderNumber: updatedOrder.orderNumber,
        status: this.toDashboardStatus(updatedOrder.status),
      };
    } catch {
      throw new NotFoundException('Order not found.');
    }
  }

  async delete(id: string) {
    try {
      const order = await this.prisma.order.delete({
        where: {
          id,
        },
      });

      await rm(join(this.uploadsRoot, id), { recursive: true, force: true });

      return {
        id: order.id,
        orderNumber: order.orderNumber,
        deleted: true,
      };
    } catch {
      throw new NotFoundException('Order not found.');
    }
  }

  private parseOrder(rawOrder: string): IncomingOrder {
    try {
      const order = JSON.parse(rawOrder) as IncomingOrder;

      if (!order.bag || !Array.isArray(order.designs) || !order.customer) {
        throw new Error('Invalid order shape.');
      }

      return order;
    } catch {
      throw new BadRequestException('Order payload must be valid JSON.');
    }
  }

  private toOrderData(order: IncomingOrder) {
    return {
      fabric: order.bag.fabric,
      quantity: order.bag.quantity,
      dueDate: order.bag.dueDate,
      productionStartDate: order.bag.productionStartDate,
      includeSunday: order.bag.includeSunday,
      width: order.bag.width,
      height: order.bag.height,
      gusset: order.bag.gusset,
      zip: order.bag.zip,
      color: order.bag.color,
      handle: order.bag.handle,
      print: order.bag.print,
      notes: order.bag.notes ?? null,
      customerName: order.customer.name,
      customerPhone: order.customer.phone,
      customerAlternatePhone: order.customer.alternatePhone || null,
      customerAddress: order.customer.address,
      customerCourierType: order.customer.courierType,
      customerCourierNotes: order.customer.courierNotes || null,
    };
  }

  private toDesignData(design: StoredDesign, index: number) {
    return {
      sortOrder: index,
      fileName: design.fileName,
      notes: design.notes,
      originalName: design.uploadedFile?.originalName ?? null,
      storedName: design.uploadedFile?.storedName ?? null,
      mimeType: design.uploadedFile?.mimeType ?? null,
      size: design.uploadedFile?.size ?? null,
      path: design.uploadedFile?.path ?? null,
      url: design.uploadedFile?.url ?? null,
    };
  }

  private toStoredOrder(order: OrderWithDesigns): StoredOrder {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      createdAt: order.updatedAt.toISOString(),
      bag: {
        fabric: order.fabric,
        quantity: order.quantity,
        dueDate: order.dueDate,
        productionStartDate: order.productionStartDate,
        includeSunday: order.includeSunday,
        width: order.width,
        height: order.height,
        gusset: order.gusset,
        zip: order.zip,
        color: order.color,
        handle: order.handle,
        print: order.print,
        notes: order.notes,
      },
      customer: {
        name: order.customerName,
        phone: order.customerPhone,
        alternatePhone: order.customerAlternatePhone ?? '',
        address: order.customerAddress,
        courierType: order.customerCourierType,
        courierNotes: order.customerCourierNotes ?? '',
      },
      designs: order.designs.map((design) => ({
        fileName: design.fileName,
        notes: design.notes,
        uploadedFile:
          design.originalName && design.storedName && design.mimeType && design.path && design.url
            ? {
                originalName: design.originalName,
                storedName: design.storedName,
                mimeType: design.mimeType,
                size: design.size ?? 0,
                path: design.path,
                url: design.url,
              }
            : null,
      })),
    };
  }

  private async planCapacityReservations(order: IncomingOrder, excludeOrderId?: string) {
    if (!order.bag.quantity) {
      return [];
    }

    const dailyCapacity = await this.getDailyJuteCapacity();
    const dueDate = this.parseDate(order.bag.dueDate);
    const requestedStartDate = this.parseDate(order.bag.productionStartDate);
    const today = new Date();
    today.setHours(12, 0, 0, 0);

    if (dueDate < today || requestedStartDate < today) {
      throw new BadRequestException('Production start and dispatch dates cannot be in the past.');
    }

    const earliestDate = requestedStartDate > today ? requestedStartDate : today;

    if (dueDate < earliestDate) {
      throw new BadRequestException('Dispatch date must be on or after the production start date.');
    }

    const reservations = await this.prisma.orderCapacityReservation.findMany({
      where: {
        productionDate: {
          gte: this.toDateKey(earliestDate),
          lte: this.toDateKey(dueDate),
        },
        ...(excludeOrderId ? { orderId: { not: excludeOrderId } } : {}),
      },
    });
    const bookedCapacity = new Map<string, number>();

    reservations.forEach((reservation) => {
      bookedCapacity.set(
        reservation.productionDate,
        (bookedCapacity.get(reservation.productionDate) ?? 0) + reservation.quantity,
      );
    });

    const plan: Array<{ productionDate: string; quantity: number }> = [];
    const date = new Date(dueDate);
    let remainingQuantity = order.bag.quantity;

    while (remainingQuantity > 0 && date >= earliestDate) {
      const productionDate = this.toDateKey(date);
      const isSunday = date.getDay() === 0;

      if (isSunday && !order.bag.includeSunday) {
        date.setDate(date.getDate() - 1);
        continue;
      }

      const isEarliestDate = productionDate === this.toDateKey(earliestDate);
      const availableCapacity = Math.max(dailyCapacity - (bookedCapacity.get(productionDate) ?? 0), 0);
      const quantity = isEarliestDate
        ? remainingQuantity
        : Math.min(remainingQuantity, availableCapacity);

      if (quantity > 0) {
        plan.push({ productionDate, quantity });
        remainingQuantity -= quantity;
      }

      date.setDate(date.getDate() - 1);
    }

    if (remainingQuantity > 0) {
      throw new BadRequestException('There are no valid production days available in the selected date range.');
    }

    return plan;
  }

  private async getDailyJuteCapacity(): Promise<number> {
    const settings = await this.prisma.appSettings.findUnique({
      where: {
        id: SETTINGS_ID,
      },
    });
    const value = settings?.value as Record<string, unknown> | null | undefined;
    const configuredCapacity = Number(value?.['currentCapacity']);

    return Number.isFinite(configuredCapacity) && configuredCapacity > 0
      ? configuredCapacity
      : DEFAULT_DAILY_JUTE_CAPACITY;
  }

  private parseDate(value: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException('Production and dispatch dates must use YYYY-MM-DD format.');
    }

    const date = new Date(`${value}T12:00:00`);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid production or dispatch date.');
    }

    return date;
  }

  private toDateKey(date: Date): string {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  }

  private async storeDesigns(
    order: IncomingOrder,
    id: string,
    fileByDesignIndex: Map<number, UploadedOrderFile>,
  ): Promise<StoredDesign[]> {
    return Promise.all(
      order.designs.map(async (design, index) => {
        const file = fileByDesignIndex.get(index);

        if (!file) {
          return {
            fileName: design.fileName,
            notes: design.notes,
            uploadedFile: design.uploadedFile ?? null,
          };
        }

        const extension = extname(file.originalname);
        const storedName = `design-${index + 1}-${randomUUID()}${extension}`;
        const orderUploadRoot = join(this.uploadsRoot, id);
        const relativePath = `/uploads/orders/${id}/${storedName}`;

        await mkdir(orderUploadRoot, { recursive: true });
        await writeFile(join(orderUploadRoot, storedName), file.buffer);

        return {
          fileName: design.fileName || file.originalname,
          notes: design.notes,
          uploadedFile: {
            originalName: file.originalname,
            storedName,
            mimeType: file.mimetype,
            size: file.size,
            path: relativePath,
            url: `${process.env.BACKEND_PUBLIC_URL ?? 'http://localhost:3000'}${relativePath}`,
          },
        };
      }),
    );
  }

  private mapFilesByDesignIndex(files: UploadedOrderFile[]) {
    const fileByDesignIndex = new Map<number, UploadedOrderFile>();

    for (const file of files) {
      const match = /^designFile_(\d+)$/.exec(file.fieldname);

      if (match) {
        fileByDesignIndex.set(Number(match[1]), file);
      }
    }

    return fileByDesignIndex;
  }

  private async createNextOrderNumber(): Promise<string> {
    const orders = await this.prisma.order.findMany({
      select: {
        orderNumber: true,
      },
    });
    const latestNumber = orders.reduce((latest, order) => {
      const match = /^C9-(\d+)$/.exec(order.orderNumber ?? '');
      return match ? Math.max(latest, Number(match[1])) : latest;
    }, 1054);

    return `C9-${latestNumber + 1}`;
  }

  private toStoredStatus(status: string): OrderStatus {
    const statuses: Record<DashboardOrderStatus, OrderStatus> = {
      'Ready to pick': OrderStatus.ORDER_CREATED,
      'In progress': OrderStatus.IN_PROGRESS,
      Complete: OrderStatus.COMPLETE,
    };
    const storedStatus = statuses[status as DashboardOrderStatus];

    if (!storedStatus) {
      throw new BadRequestException('Invalid order status.');
    }

    return storedStatus;
  }

  private toDashboardStatus(status: OrderStatus): DashboardOrderStatus {
    const statuses: Record<OrderStatus, DashboardOrderStatus> = {
      DRAFT: 'Ready to pick',
      ORDER_CREATED: 'Ready to pick',
      IN_PROGRESS: 'In progress',
      COMPLETE: 'Complete',
    };

    return statuses[status];
  }
}
