ALTER TABLE "orders" ADD COLUMN "productionStartDate" TEXT NOT NULL DEFAULT '';

CREATE TABLE "order_capacity_reservations" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productionDate" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_capacity_reservations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "order_capacity_reservations_productionDate_idx" ON "order_capacity_reservations"("productionDate");
CREATE INDEX "order_capacity_reservations_orderId_idx" ON "order_capacity_reservations"("orderId");

ALTER TABLE "order_capacity_reservations" ADD CONSTRAINT "order_capacity_reservations_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
