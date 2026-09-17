# React Router + Vite SPA sample

## Overview

`service-template` に、既存の Next.js サンプル (`packages/client`) と並ぶ React Router v7 + Vite の SPA サンプルを追加する。

`packages/spa` は runtime application server を持たない。build の成果物は静的ファイルだけであり、nginx、CDN、object storage + CDN など任意の static hosting から配信できることを前提とする。

React Router は `ssr: false` の SPA mode を使う。build 時に `index.html` を生成するための React Router の server entry は存在してもよいが、production runtime の Node server ではない。

## Runtime contract

SPA の runtime contract は次の2点だけとする。

1. `dist/public` 以下の静的ファイルを配信する。
2. browser から見て same-origin の `GET /api/user` が利用できる。

SPA package 自身は `/api/user` を実装、proxy、認証変換しない。

### Browser request

初回画面表示時、browser は次の same-origin request を1回だけ実行する。

```http
GET /api/user
Accept: application/json
Cookie: session=<httpOnly session value>
```

browser code は次の形で取得する。

```ts
fetch('/api/user', {
  cache: 'no-store',
  credentials: 'include',
  headers: {
    Accept: 'application/json'
  }
})
```

`session` cookie の値を JavaScript から読まない。credential を build-time env、HTML、client bundle、localStorage へ渡さない。

### API response

既存 API の `GET /api/user` response を表示データとして使用する。

```json
{
  "count": 2,
  "user": [
    {
      "id": 1,
      "name": "Alice",
      "created_at": 1710000000,
      "updated_at": 1710003600
    },
    {
      "id": 2,
      "name": "Bob",
      "created_at": 1710007200,
      "updated_at": 1710010800
    }
  ]
}
```

`count` と `user` の shape、件数、数値、timestamp は browser 側の `parseUserResponse` で検証する。

## Deployment boundary

`packages/spa` は static hosting だけを担当する。API routing と authentication boundary は deployment environment の責務とする。

現在の `packages/api` は `Authorization` header を要求するため、既存 API をそのまま利用する場合は reverse proxy / ingress / BFF など SPA package の外側で `session` cookie を upstream の Authorization へ変換する。

この変換は SPA の runtime server として実装しない。

### nginx example

以下は deployment topology の一例であり、SPA application code の一部ではない。

```nginx
server {
    listen 8080;
    root /srv/service-template-spa;

    location = /api/user {
        proxy_set_header Authorization "Bearer $cookie_session";
        proxy_pass http://api:8000/api/user;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

これにより browser からは static assets と `/api/user` が同一 origin に見える。`GET /api/user` 以外へ cookie-to-Authorization を一般化する場合は、state-changing request の CSRF 方針を別途設計する。

同じ契約を満たせるなら nginx 以外の hosting / gateway でもよい。

## Development and preview

```bash
npm run dev -w spa
npm run tsc -w spa
npm run build -w spa
npm run start -w spa
npm run test -w spa
```

- `dev`: Vite development server。API proxy は持たない。
- `build`: `dist/public` に static SPA artifact を生成する。
- `start`: `vite preview --outDir dist/public` で build artifact を静的配信するだけ。production server としては使わない。
- API と結合して確認する場合は、Vite/nginx の前段または別 gateway で same-origin `/api/user` を用意する。

## Application routes

- `/`: dashboard
- `/dashboard` など extensionless application path: hosting 側で `index.html` へ fallback する
- asset path: `dist/public/assets/*`

static host は application route を `index.html` へ fallback できればよく、Node 固有の runtime を要求しない。

## Dashboard

- header: service name、接続状態
- summary: user count
- user list: name、identifier、created/updated timestamp
- loading: skeleton または loading indicator
- success: users を表示
- empty: count が0の場合の空状態
- failure: connection/API/auth failure を利用者向け固定文言で表示
- small viewport: 1列化し、横スクロール・text clipping を発生させない
- visual direction: limit-monitor を参考にした dark surface、低彩度の border、green の online accent

UI は `GET /api/user` 以外の API call を行わない。

## Error handling

- 401/403: authentication failure として表示する。
- その他の non-success / network failure: connection failure として表示する。
- HTTP 200 でも response JSON が不正、`count` と `user.length` が不一致、必須 field が不正: browser 側で failure state にする。
- upstream の error body や credential を UI / console へ出さない。

## Out of scope

- SPA package 内の Node runtime server
- SPA package 内の static file server 実装
- SPA package 内の API proxy / BFF
- SPA package 内の cookie-to-Authorization adapter
- SPA 独自の login、session 発行、refresh、logout
- JavaScript からの cookie 読み取り
- SSR / server action
- user 以外の API endpoint
- production gateway / DNS / TLS の実装

## Acceptance criteria

- `packages/spa` が React Router v7 + Vite `ssr: false` の static SPA として build できる。
- build artifact は `dist/public` の静的ファイルだけで構成され、production runtime Node server を必要としない。
- browser client は `credentials: 'include'` で same-origin `/api/user` を1回取得する。
- browser code は session cookie を直接読まない。
- SPA package に API proxy、cookie forwarding、Authorization injection の server code が存在しない。
- nginx 等から `dist/public` を配信し、application route を `index.html` へ fallback できる。
- `/api/user` の実装方法は deployment environment に委譲され、SPA はその方式に依存しない。
- loading、success、empty、failure の dashboard state が deterministic fixture で確認できる。
- SPA および既存 client/shared の format、lint、typecheck、build、test が成功する。
