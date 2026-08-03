FROM node:24 AS builder
WORKDIR /app

COPY package.json package-lock.json .npmrc ./
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci --min-release-age=7

COPY packages/shared packages/shared
RUN npm run build -w shared

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json .npmrc ./
COPY --from=builder /app/packages/shared/package.json packages/shared/package.json
COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY packages/shared/prisma packages/shared/prisma
COPY packages/shared/prisma.config.ts packages/shared/prisma.config.ts
RUN npm ci --omit=dev --min-release-age=7 -w shared

USER node
CMD ["npm", "run", "db-migrate:deploy", "-w", "shared"]
