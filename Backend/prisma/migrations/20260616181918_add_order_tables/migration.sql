-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'ORDER_CREATED', 'IN_PROGRESS', 'COMPLETE');

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'ORDER_CREATED',
    "fabric" TEXT NOT NULL,
    "quantity" INTEGER,
    "dueDate" TEXT NOT NULL,
    "width" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,
    "gusset" DOUBLE PRECISION,
    "zip" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "print" TEXT NOT NULL,
    "notes" TEXT,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "customerAlternatePhone" TEXT,
    "customerAddress" TEXT NOT NULL,
    "customerCourierType" TEXT NOT NULL,
    "customerCourierNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_designs" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "fileName" TEXT,
    "notes" TEXT,
    "originalName" TEXT,
    "storedName" TEXT,
    "mimeType" TEXT,
    "size" INTEGER,
    "path" TEXT,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_designs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "orders_orderNumber_key" ON "orders"("orderNumber");

-- CreateIndex
CREATE INDEX "order_designs_orderId_idx" ON "order_designs"("orderId");

-- AddForeignKey
ALTER TABLE "order_designs" ADD CONSTRAINT "order_designs_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
