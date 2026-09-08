-- AlterTable
ALTER TABLE "AIPrediction" ADD COLUMN     "engineVersion" TEXT NOT NULL DEFAULT 'unversioned',
ADD COLUMN     "inputHash" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "rulesVersion" TEXT NOT NULL DEFAULT 'unversioned';

-- CreateIndex
CREATE INDEX "AIPrediction_inputHash_idx" ON "AIPrediction"("inputHash");
