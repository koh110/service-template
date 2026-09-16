# React Router + Vite SPA sample

## Overview

`service-template`へ、既存のNext.jsサンプル（`packages/client`）と並ぶ、React Router v7 + ViteのSPAサンプルを追加する。目的は、limit-monitor風のdark dashboardを、SSRやserver actionなしで実装すること。

SPAのbrowser codeは認証credentialを生成・保持・展開しない。Next.jsサンプルが発行する`session` cookieを、browserの通常のcookie送信機能で同一originのAPIへ渡す。

## Inputs and outputs

### Browser request

初回画面表示時、browserは次のsame-origin requestを1回だけ実行する。

```http
GET /api/user
Accept: application/json
Cookie: session=<httpOnly session value>
```

`session`はJavaScriptから読まない。`fetch`へ`credentials: 'include'`を明示し、browserがcookieを送る。

### API response

既存APIの`GET /api/user` responseを表示データとして使用する。

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

`count`と`user`のshape、件数、数値・timestampはbrowser側の`parseUserResponse`で検証する。server側で表示用JSONをparse・再serialize・補正しない。

## Authentication boundary

Next.jsサンプルの次の実装を参照する。

- `packages/client/src/app/_lib/auth/index.ts`: cookie名`session`
- `packages/client/src/app/api/auth/session/route.ts`: session cookieを発行する認証境界
- `packages/client/src/app/proxy/api/[...path]/route.ts`: httpOnly cookieをserver側で読み、既存APIのAuthorizationへ変換するproxy

SPA側の契約は次の通り。

1. SPAのJavaScriptへcredentialを埋め込まない。
2. `session` cookieの値をJavaScriptで読む、localStorageへコピーする、HTMLへ出力する処理を追加しない。
3. browserの`fetch('/api/user', { credentials: 'include' })`を使う。
4. 既存APIがAuthorization headerを要求するため、standalone Node配信serverを利用する場合だけ、server側に薄いcookie-to-header adapterを置く。
5. adapterはsession cookieの有無を確認し、既存APIへ`Authorization: Bearer <session value>`を付けるだけとする。認証判断は既存APIへ委譲し、SPA serverでsession claimsを解釈しない。
6. adapterはupstreamの成功bodyをそのままbrowserへ返し、shape validation・表示用変換・件数計算を行わない。

このadapterはSPAの業務serverではなく、既存APIとhttpOnly cookieのtransport境界である。Next.js proxy routeを持つhostへSPAを組み込む場合は、同じoriginの`/api/user`をhost側へ委譲してもよい。

## Tech stack and runtime

- workspace: `spa`
- React 19
- React Router v7
- Vite
- React Router config: `ssr: false`
- TypeScript
- Node.js HTTP server: build済み静的asset配信と、必要なcookie-to-header adapterだけを担当
- `zod`: browser側response validation

### Runtime environment

- `API_URI`: standalone adapterが接続する既存API origin。browserへ公開しない。既定値は`http://localhost:8000`。
- `HOST`: standalone serverのbind address。既定値は`127.0.0.1`。loopback以外は拒否する。
- `PORT`: standalone serverのport。既定値は`8789`。
- `SPA_DIST_DIR`: 静的配信root。未指定時は`dist/public`。

固定credentialを指定する環境変数は持たない。sessionはhostの認証フローが発行するhttpOnly cookieであり、SPA buildへ取り込まない。

session cookieはhost単位で送信されるため、Next.jsサンプルとSPAを同じhostnameで開く。既定値を使う場合は両方を`127.0.0.1`で開き、`localhost`を使う場合は`HOST=localhost`で起動して両方を`localhost`で開く。portが異なってもcookieのhost条件は変わらない。

### Commands

```bash
npm run dev -w spa
npm run tsc -w spa
npm run format-check -w spa
npm run build -w spa
npm run start -w spa
npm run test -w spa
```

`build`は`dist/public`へbrowser assetを生成し、standalone実行用のserver codeだけを`dist/server`へ生成する。`start`は`dist/public`を静的配信する。

## Interface

### Application route

- `/`: dashboard
- `/dashboard`などextensionless path: static serverのSPA fallback。application routeを増やさない。
- asset path: `dist/public/assets/*`

### Dashboard

- header: service name、接続状態
- summary: user count
- user list: name、identifier、created/updated timestamp
- loading: skeletonまたはloading indicator
- success: usersを表示
- empty: countが0の場合の空状態
- failure: connection/API/auth failureをユーザー向けの固定文言で表示
- small viewport: 1列化し、横スクロール・text clippingを発生させない
- visual direction: limit-monitorを参考にしたdark surface、低彩度のborder、greenのonline accent

UIは`GET /api/user`以外のAPI callを行わない。refresh操作を追加する場合も、明示操作につき1 requestとする。

### Standalone transport

standalone serverのAPI boundaryは`GET /api/user`だけを扱う。

- session cookieなし: `401 Not authenticated\n`
- upstream success: JSON bodyをbrowserへ転送、`Cache-Control: no-store`
- upstreamの401/403: statusを保持した固定認証失敗文言。その他の非成功、redirect、network error、timeout: `502 Bad Gateway\n`
- query付き`/api/user`、未知の`/api/*`: APIとして処理しない
- static path: GET/HEADだけを受理し、extensionless pathだけSPA fallbackする

serverはupstream responseのshapeを検証しない。browser clientがHTTP success bodyをparseし、invalid shapeをfailure stateへ変換する。

### Development transport

Vite dev serverでもbrowserから見えるendpointはsame-originの`/api/user`とする。dev middlewareはstandalone adapterと同じcookie forwardingを使う。Vite serverのauthorityが確定していない間はstatic requestをViteへ委譲し、API requestを推測したupstreamへ送らない。

## Error handling

- session cookieなし: login/sessionが必要な状態としてfailure UIを表示する。
- upstreamの401/403: transportはstatusを保持した固定認証失敗文言へ変換する。5xxその他の非成功は固定502へ変換し、いずれもupstream bodyをbrowserへ漏らさない。
- redirect/network/timeout: 固定502へ変換する。
- HTTP 200でもresponse JSONが不正、`count`と`user.length`が不一致、必須fieldが不正: browser側でfailure UIを表示する。
- malformed URL、path traversal、配信root外、symlink asset: static serverは固定400/404で拒否する。
- credentialやupstream内部情報をHTML、client bundle、console、error responseへ出力しない。

## Non-functional requirements

- browser bundleにcredentialを含めない。
- `session` cookieはJavaScriptから直接参照しない。
- 初回navigationのuser GETを1回だけ行い、user件数に比例するAPI callを行わない。
- serverの業務処理はcookie forwardingと静的配信に限定する。response validation、表示データ変換、session claims処理、refresh token管理はSPA serverへ追加しない。
- static serverはloopback bind、exact authority/originチェック、raw URLの安全なparse、配信root外拒否、symlink拒否、`O_NOFOLLOW`での最終file openを維持する。
- UIは390px相当のsmall viewportからdesktopまで横方向の欠落・overflow・clippingなしで表示する。
- CIはSPAのformat、format-check、lint、shared build、typecheck、build、testを実行する。既存`packages/client`とsharedの検証も壊さない。

## Out of scope

- SPA独自のlogin画面、session発行、session refresh、logout
- JavaScriptからのcookie読み取り
- credentialをVite define、public env、localStorageへ渡すこと
- SSR、React Router loader/actionを使ったserver rendering
- user以外のAPI endpoint
- limit-monitor固有のmeter、quota、billing APIの追加
- API schemaや既存APIの認証実装変更
- production deploy、DNS、external reverse proxy設定

## Acceptance criteria

- `packages/spa`がnpm workspaceとして`packages/client`と併存する。
- React 19 + React Router v7 + Vite `ssr: false`のbuildが成功する。
- browser clientが`credentials: 'include'`でsame-origin `/api/user`を1回取得する。
- client bundle、HTML、console、error responseへcredentialが出ない。
- standalone serverに固定credential設定がなく、session cookie不在時は401になる。
- session cookieがある場合だけadapterが既存APIへAuthorizationを付け、成功bodyをbrowserへ返す。
- adapterがupstream shapeを検証・再serializeせず、client側validationがinvalid responseをfailureへ変換する。
- upstreamの401/403は認証失敗文言、それ以外の非成功、redirect、network error、timeoutは固定502になる。
- static asset、SPA fallback、authority、origin、path traversal、symlink境界がテストされる。
- loading、success、empty、failureのdashboard stateがdeterministic fixtureで確認できる。
- small viewportとdesktopで横overflow・clippingがない。
- SPAおよび既存client/sharedのformat、lint、typecheck、build、testが成功する。

## Verified references

- `packages/client/src/app/_lib/auth/index.ts`: `session` cookie name
- `packages/client/src/app/api/auth/session/route.ts`: host-side session route
- `packages/client/src/app/proxy/api/[...path]/route.ts`: cookie-to-Authorization proxy pattern
- `packages/api/src/lib/middleware.ts`: existing API Authorization requirement
- `packages/shared/typespec/user.tsp`: `GET /api/user` response contract
