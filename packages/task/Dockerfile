FROM node:24 AS builder
WORKDIR /app

COPY package.json package-lock.json .npmrc ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/task/package.json packages/task/package.json
RUN npm ci --min-release-age=7

COPY packages/shared packages/shared
COPY packages/task packages/task
RUN npm run build -w shared
RUN npm run build -w task

# migrate タスクが `npm run db-migrate:deploy -w shared` を execFile で叩くため、
# runner にも npm(node に同梱)と shared の package.json/dist/prisma 一式を含める。
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json .npmrc ./
COPY --from=builder /app/packages/shared/package.json packages/shared/package.json
COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY packages/shared/prisma packages/shared/prisma
COPY packages/shared/prisma.config.ts packages/shared/prisma.config.ts
COPY --from=builder /app/packages/task/package.json packages/task/package.json
COPY --from=builder /app/packages/task/dist packages/task/dist
RUN npm ci --omit=dev --min-release-age=7 -w shared -w task

USER node
ENTRYPOINT ["node", "packages/task/dist/src/index.js"]
