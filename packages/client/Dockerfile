FROM node:24 AS builder
WORKDIR /app

COPY package.json package-lock.json .npmrc ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/client/package.json packages/client/package.json
RUN npm ci --min-release-age=7

COPY packages/shared packages/shared
COPY packages/client packages/client
RUN npm run build -w shared
RUN npm run build -w client

# Next.js の `output: 'standalone'` はモノレポのディレクトリ構造を保ったまま出力する。
# server.js は packages/client/server.js に置かれる。static/public は standalone
# 出力に含まれないため別途コピーする(Next.js 公式の Docker デプロイ手順どおり)。
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# APP_ENV=production を明示することで localAuthProvider(認証スタブ)を
# fail-closed にする(コード側の allowlist が主防御だが、多層防御として設定する)
ENV APP_ENV=production

COPY --from=builder --chown=node:node /app/packages/client/.next/standalone ./
COPY --from=builder --chown=node:node /app/packages/client/.next/static packages/client/.next/static
COPY --from=builder --chown=node:node /app/packages/client/public packages/client/public

USER node
ENV PORT=3000
EXPOSE 3000
CMD ["node", "packages/client/server.js"]
