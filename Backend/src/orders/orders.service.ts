import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

type OrderStatus = 'DRAFT' | 'ORDER_CREATED' | 'IN_PROGRESS' | 'COMPLETE';
type DashboardOrderStatus = 'Ready to pick' | 'In progress' | 'Complete';

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
  fileName: string;
  notes: string;
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

@Injectable()
export class OrdersService {
  private readonly storageRoot = join(process.cwd(), 'storage', 'orders');
  private readonly uploadsRoot = join(process.cwd(), 'uploads', 'orders');
  private readonly ordersFile = join(this.storageRoot, 'orders.json');

  async create(rawOrder: string, files: UploadedOrderFile[]): Promise<StoredOrder> {
    const order = this.parseOrder(rawOrder);
    const id = `ord_${randomUUID()}`;
    const createdAt = new Date().toISOString();
    const orderUploadRoot = join(this.uploadsRoot, id);
    const fileByDesignIndex = this.mapFilesByDesignIndex(files);
    const existingOrders = await this.readOrders();
    const orderNumber = this.createNextOrderNumber(existingOrders);

    await mkdir(orderUploadRoot, { recursive: true });

    const designs = await this.storeDesigns(order, id, orderUploadRoot, fileByDesignIndex);

    const storedOrder: StoredOrder = {
      id,
      orderNumber,
      status: 'ORDER_CREATED',
      createdAt,
      bag: order.bag,
      customer: order.customer,
      designs,
    };

    await this.writeOrders([storedOrder, ...existingOrders]);

    return storedOrder;
  }

  async update(id: string, rawOrder: string, files: UploadedOrderFile[]): Promise<StoredOrder> {
    const order = this.parseOrder(rawOrder);
    const orders = await this.readOrders();
    const orderIndex = orders.findIndex((candidate) => candidate.id === id);

    if (orderIndex === -1) {
      throw new NotFoundException('Order not found.');
    }

    const existingOrder = orders[orderIndex];
    const orderUploadRoot = join(this.uploadsRoot, id);
    const fileByDesignIndex = this.mapFilesByDesignIndex(files);

    await mkdir(orderUploadRoot, { recursive: true });

    const updatedOrder: StoredOrder = {
      ...existingOrder,
      status: 'ORDER_CREATED',
      createdAt: new Date().toISOString(),
      bag: order.bag,
      customer: order.customer,
      designs: await this.storeDesigns(order, id, orderUploadRoot, fileByDesignIndex),
    };
    const updatedOrders = [...orders];
    updatedOrders[orderIndex] = updatedOrder;

    await this.writeOrders(updatedOrders);

    return updatedOrder;
  }

  async findAllForDashboard() {
    const orders = await this.readOrders();

    return orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      type: order.bag.fabric,
      quantity: order.bag.quantity ?? null,
      size: `${order.bag.width ?? 0}w x ${order.bag.height ?? 0}h x ${order.bag.gusset ?? 0}g`,
      updatedDate: order.createdAt,
      status: this.toDashboardStatus(order.status),
      dueDate: order.bag.dueDate,
    }));
  }

  async findOne(id: string) {
    const orders = await this.readOrders();
    const order = orders.find((candidate) => candidate.id === id);

    if (!order) {
      throw new NotFoundException('Order not found.');
    }

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: this.toDashboardStatus(order.status),
      updatedDate: order.createdAt,
      bag: order.bag,
      customer: order.customer,
      designs: order.designs,
    };
  }

  private async storeDesigns(
    order: IncomingOrder,
    id: string,
    orderUploadRoot: string,
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
        const absolutePath = join(orderUploadRoot, storedName);
        const relativePath = `/uploads/orders/${id}/${storedName}`;

        await writeFile(absolutePath, file.buffer);

        return {
          fileName: design.fileName || file.originalname,
          notes: design.notes,
          uploadedFile: {
            originalName: file.originalname,
            storedName,
            mimeType: file.mimetype,
            size: file.size,
            path: relativePath,
            url: `http://localhost:3000${relativePath}`,
          },
        };
      }),
    );
  }


  async updateStatus(id: string, dashboardStatus: string) {
    const status = this.toStoredStatus(dashboardStatus);
    const orders = await this.readOrders();
    const orderIndex = orders.findIndex((order) => order.id === id);

    if (orderIndex === -1) {
      throw new NotFoundException('Order not found.');
    }

    const updatedOrder: StoredOrder = {
      ...orders[orderIndex],
      status,
    };
    const updatedOrders = [...orders];
    updatedOrders[orderIndex] = updatedOrder;

    await this.writeOrders(updatedOrders);

    return {
      id: updatedOrder.id,
      orderNumber: updatedOrder.orderNumber,
      status: this.toDashboardStatus(updatedOrder.status),
    };
  }

  async delete(id: string) {
    const orders = await this.readOrders();
    const order = orders.find((candidate) => candidate.id === id);

    if (!order) {
      throw new NotFoundException('Order not found.');
    }

    await this.writeOrders(orders.filter((candidate) => candidate.id !== id));
    await rm(join(this.uploadsRoot, id), { recursive: true, force: true });

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      deleted: true,
    };
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

  private async readOrders(): Promise<StoredOrder[]> {
    try {
      const rawOrders = await readFile(this.ordersFile, 'utf8');
      return this.withOrderNumbers(JSON.parse(rawOrders) as StoredOrder[]);
    } catch {
      return [];
    }
  }

  private async writeOrders(orders: StoredOrder[]) {
    await mkdir(this.storageRoot, { recursive: true });
    await writeFile(this.ordersFile, JSON.stringify(orders, null, 2));
  }

  private createNextOrderNumber(orders: StoredOrder[]): string {
    const latestNumber = orders.reduce((latest, order) => {
      const match = /^C9-(\d+)$/.exec(order.orderNumber ?? '');
      return match ? Math.max(latest, Number(match[1])) : latest;
    }, 1054);

    return `C9-${latestNumber + 1}`;
  }

  private withOrderNumbers(orders: StoredOrder[]): StoredOrder[] {
    return orders.map((order, index) => ({
      ...order,
      orderNumber: order.orderNumber ?? `C9-${1054 + orders.length - index}`,
    }));
  }

  private toStoredStatus(status: string): OrderStatus {
    const statuses: Record<DashboardOrderStatus, OrderStatus> = {
      'Ready to pick': 'ORDER_CREATED',
      'In progress': 'IN_PROGRESS',
      Complete: 'COMPLETE',
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
