FROM node:24-alpine AS deps
WORKDIR /app
ENV NODE_ENV=development
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --include=dev

FROM deps AS build
WORKDIR /app
ENV NODE_ENV=development
COPY . .
RUN npx prisma generate --schema prisma/schema.prisma
RUN npm run build -w @team-llm-gateway/api
RUN npm run build -w @team-llm-gateway/web

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --omit=dev
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/web/dist apps/web/dist
COPY --from=build /app/prisma prisma
COPY --from=build /app/node_modules/.prisma node_modules/.prisma
COPY --from=build /app/node_modules/@prisma node_modules/@prisma
EXPOSE 3000
CMD ["node", "apps/api/dist/server.js"]
