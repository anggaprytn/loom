CREATE TYPE "ProviderAuthType" AS ENUM ('api_key', 'none');

CREATE TABLE "Provider" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "authType" "ProviderAuthType" NOT NULL DEFAULT 'api_key',
    "encryptedApiKey" TEXT,
    "apiKeyLast4" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "healthStatus" TEXT,
    "lastHealthAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Provider_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModelAlias" (
    "id" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "upstreamModel" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModelAlias_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Provider_slug_key" ON "Provider"("slug");
CREATE INDEX "Provider_enabled_idx" ON "Provider"("enabled");
CREATE UNIQUE INDEX "ModelAlias_alias_key" ON "ModelAlias"("alias");
CREATE INDEX "ModelAlias_providerId_idx" ON "ModelAlias"("providerId");
CREATE INDEX "ModelAlias_enabled_idx" ON "ModelAlias"("enabled");

ALTER TABLE "ModelAlias"
ADD CONSTRAINT "ModelAlias_providerId_fkey"
FOREIGN KEY ("providerId") REFERENCES "Provider"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
