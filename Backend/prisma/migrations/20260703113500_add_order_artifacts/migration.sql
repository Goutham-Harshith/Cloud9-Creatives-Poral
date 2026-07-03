CREATE TYPE "OrderArtifactType" AS ENUM ('STATUS_UPDATED', 'ORDER_EDITED', 'PROOF_UPLOADED');

CREATE TABLE "order_artifacts" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "type" "OrderArtifactType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorName" TEXT,
    "actorEmail" TEXT,
    "actorRole" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_artifacts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "order_artifacts_orderId_idx" ON "order_artifacts"("orderId");
CREATE INDEX "order_artifacts_createdAt_idx" ON "order_artifacts"("createdAt");

ALTER TABLE "order_artifacts"
ADD CONSTRAINT "order_artifacts_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
