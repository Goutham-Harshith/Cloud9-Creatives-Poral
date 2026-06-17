const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');
const { PrismaClient, OrderStatus } = require('@prisma/client');

const envPath = join(process.cwd(), '.env');

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = /^([^#=\s]+)=(.*)$/.exec(line.trim());

    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^"|"$/g, '');
    }
  }
}

const prisma = new PrismaClient();
const ordersPath = join(process.cwd(), 'storage', 'orders', 'orders.json');

const toStatus = (status) =>
  OrderStatus[status] ?? OrderStatus.ORDER_CREATED;

const toNumber = (value) =>
  value === null || value === undefined || value === '' ? null : Number(value);

async function main() {
  if (!existsSync(ordersPath)) {
    console.log('No JSON orders file found.');
    return;
  }

  const orders = JSON.parse(readFileSync(ordersPath, 'utf8'));

  for (const order of orders) {
    await prisma.order.upsert({
      where: {
        id: order.id,
      },
      create: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: toStatus(order.status),
        fabric: order.bag.fabric,
        quantity: order.bag.quantity,
        dueDate: order.bag.dueDate,
        width: toNumber(order.bag.width),
        height: toNumber(order.bag.height),
        gusset: toNumber(order.bag.gusset),
        zip: order.bag.zip,
        color: order.bag.color,
        handle: order.bag.handle,
        print: order.bag.print,
        notes: order.bag.notes || null,
        customerName: order.customer.name,
        customerPhone: order.customer.phone,
        customerAlternatePhone: order.customer.alternatePhone || null,
        customerAddress: order.customer.address,
        customerCourierType: order.customer.courierType,
        customerCourierNotes: order.customer.courierNotes || null,
        createdAt: new Date(order.createdAt),
        updatedAt: new Date(order.createdAt),
        designs: {
          create: order.designs.map((design, index) => ({
            sortOrder: index,
            fileName: design.fileName || null,
            notes: design.notes || null,
            originalName: design.uploadedFile?.originalName ?? null,
            storedName: design.uploadedFile?.storedName ?? null,
            mimeType: design.uploadedFile?.mimeType ?? null,
            size: design.uploadedFile?.size ?? null,
            path: design.uploadedFile?.path ?? null,
            url: design.uploadedFile?.url ?? null,
          })),
        },
      },
      update: {
        status: toStatus(order.status),
      },
    });
  }

  console.log(`Imported ${orders.length} order(s).`);
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
