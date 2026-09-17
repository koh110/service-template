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

browser code は `shared/src/api-client` の型付き client を `credentials: 'include'` 付きで利用する。SPA 独自の HTTP client や API contract は再実装しない。

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

request / response type は Next.js client と同様に `shared/src/schema` を参照する共通 API client から導出する。SPA 独自の API contract、response interface、Zod schema は再定義しない。API contract の定義元は TypeSpec から生成される shared schema に一本化する。

## API client

HTTP client の共通実装は `shared/src/api-client` に置く。

- `path` と HTTP method から request / response 型を `shared/src/schema` で導出する。
- header、query、request body を schema に基づいて型付けする。
- response は status code ごとの discriminated union として返す。
- Next.js と SPA は同じ client implementation を利用する。
- browser client は薄い wrapper で `credentials: 'include'` を追加するだけとする。
- endpoint 固有の処理は generic client へ入れない。

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

- 401 / 403 は session が必要な状態として表示する。
- その他の API failure / network failure は offline state として扱う。
- API の error body は UI にそのまま表示しない。
- credential や upstream の内部情報を画面へ出さない。

## Acceptance criteria

- `packages/spa` に production runtime Node server が存在しない。
- build artifact が静的ファイルだけで構成される。
- nginx 等で `dist/public` を配信し、application route を `index.html` へ fallback できる。
- browser の API call は same-origin relative URL を使い `credentials: 'include'` を付ける。
- SPA package は cookie を読まない。
- API request / response 型は TypeSpec 生成 schema を参照する共通 API client から導出する。
- Next.js と SPA が同じ generic API client implementation を利用する。
- SPA package に API proxy / BFF / cookie-to-Authorization adapter を持たない。
- format / lint / typecheck / build / test が通る。
