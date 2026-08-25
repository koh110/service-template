FROM node:26 AS builder
WORKDIR /app

COPY package.json package-lock.json .npmrc ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/api/package.json packages/api/package.json
RUN npm ci --min-release-age=7

COPY packages/shared packages/shared
COPY packages/api packages/api
RUN npm run build -w shared
RUN npm run build -w api

FROM node:26-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# APP_ENV=production を明示することで localTokenVerifier(認証スタブ)を
# fail-closed にする(コード側の allowlist が主防御だが、多層防御として設定する)
ENV APP_ENV=production

COPY package.json package-lock.json .npmrc ./
COPY --from=builder /app/packages/shared/package.json packages/shared/package.json
COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/packages/api/package.json packages/api/package.json
COPY --from=builder /app/packages/api/dist packages/api/dist
RUN npm ci --omit=dev --min-release-age=7 -w shared -w api

USER node
ENV PORT=3000
EXPOSE 3000
CMD ["node", "packages/api/dist/src/index.js"]
