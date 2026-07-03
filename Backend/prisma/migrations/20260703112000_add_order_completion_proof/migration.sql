ALTER TABLE "orders"
ADD COLUMN "completionProofOriginalName" TEXT,
ADD COLUMN "completionProofStoredName" TEXT,
ADD COLUMN "completionProofMimeType" TEXT,
ADD COLUMN "completionProofSize" INTEGER,
ADD COLUMN "completionProofPath" TEXT,
ADD COLUMN "completionProofUrl" TEXT;
