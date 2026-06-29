ALTER TABLE "ApiKey" ADD COLUMN "litellmKeyAlias" TEXT;
ALTER TABLE "ApiKey" ADD COLUMN "litellmKeyId" TEXT;

CREATE UNIQUE INDEX "ApiKey_litellmKeyAlias_key" ON "ApiKey"("litellmKeyAlias");
CREATE INDEX "ApiKey_litellmKeyId_idx" ON "ApiKey"("litellmKeyId");
