ALTER TABLE "ModelAlias" ADD COLUMN "lastSyncedAt" TIMESTAMP(3);

CREATE INDEX "ModelAlias_lastSyncedAt_idx" ON "ModelAlias"("lastSyncedAt");
