# SPA サンプルパッケージ仕様書

## Status

- 対象ブランチ: `feature/spa-sample`
- 基準revision: `8987d1920289ee26a6228e25dfac680dd948fe14`
- Round 1 / Round 2 / Round 3の敵対的レビュー指摘を反映した改訂版。
- 最終closure review（Round 4）は同等モデルのfresh独立fallbackで実施し、Blocking/Major 0件で合格した。
- ユーザーの選択と、追加確認がタイムアウトした2点に対する安全側の仮定を含む。

## Overview

`service-template` に、既存のNext.js `packages/client`と併設できるReact SPAのサンプルとして`packages/spa`を追加する。

単一画面の目的は、`service-template`の既存APIからユーザー一覧を取得し、`limit-monitor` dashboardの視覚的方向性（暗色背景、接続状態、中央の状態パネル、カード型の情報表示、淡い境界線、状態色）で状態を確認できるようにすることである。

`limit-monitor`のaccount/bucket/meterは、`service-template`の既存APIがそのデータを返さないため実装しない。APIが返した値から残量などを推測・捏造しない。

既存の`packages/client`（Next.js）は変更せず、別workspaceとして追加する。

## Inputs & Outputs

### Runtime configuration

値はSPAのブラウザbundleへ埋め込まず、SPAを配信するNode server（およびVite dev serverのproxy）だけが読む。

- `API_URI`: 既存APIのbase URL。既定値は`http://localhost:8000`。`http`/`https`のorigin形式だけを受理し、userinfo、path、query、fragmentを拒否する。
- `API_TOKEN`: 既存APIへ渡すBearer tokenの値。前後のASCII whitespaceをtrimし、trim後が空文字の場合、proxyは固定の503を返す。tokenをログ・client bundle・レスポンスへ出さない。token内部のwhitespaceは変更せず、Authorization headerへそのまま渡す。
- `HOST`: SPA配信serverのbind address。既定値は`127.0.0.1`。外部公開によるcredentialed proxyの無認証利用を防ぐため、`127.0.0.1`、`localhost`、`::1`以外は起動時に拒否する。
- `PORT`: SPA配信serverのport。既定値は`8789`。1以上65535以下の整数だけを受理する。
- `SPA_DIST_DIR`: 静的配信root。未設定時はserver build出力から`dist/public`を解決する。`start`時に存在するdirectoryであることを確認し、欠落・非directoryなら起動を失敗させる。
- proxy timeout: 固定`5_000ms`。環境変数で緩和しない。
- upstream response最大サイズ: 固定`1_048_576 bytes`。Fetch response bodyをcontent decoding後のstream bytesとして数え、超過直後にabortして502にする。`Content-Length`だけに依存しない。

### Trust boundary and request authority

このサンプルのcredentialed proxyにはbrowser caller向けの認証機能がないため、production配信serverはloopback bindだけを許可する。さらに、routingより前に次を検証する。

- `Host` headerは、設定した`HOST`と`PORT`から作ったauthority（IPv6は角括弧を含む）との完全一致だけを受理する。別名、別port、欠落Hostは400固定bodyで拒否する。既定値へ暗黙に寄せない。
- `Origin` headerが存在する場合、`http://<configured-authority>`との完全一致だけを受理し、不一致は403固定bodyで拒否する。`Origin`がない非browser clientはHost検証を通れば受理する。
- `Access-Control-Allow-Origin`などCORS許可headerは一切返さない。
- `HOST`をloopback以外へ変更する設定は起動時に拒否する。DNS rebindingで攻撃者originからloopbackへ到達しても、Host/Origin検証でcredentialed proxyを呼び出せないようにする。
- HTTP/1 requestの`rawHeaders`で`Host` fieldがちょうど1個、`Origin` fieldが0個または1個であることを確認する。重複field、comma-joined value、欠落Hostは固定bodyで拒否し、`req.headers`の結合済みvalueだけをtrustしない。

Vite dev serverも`127.0.0.1` bind、`port: 0`、`127.0.0.1`/`localhost`のhost allowlistを設定し、同じAPI proxyのsanitizationを使う。dev proxyのeffective authorityは、listen後の`server.httpServer.address().port`と固定host名から都度導出する（例: `127.0.0.1:5173`）。dev proxyもHostをそのportとの完全一致で検証し、Originがある場合は`http://<そのHost>`との完全一致で検証する。portを取得できない間はAPI proxyを503にする。dev serverはCORSを有効にしない。

### Browser request

ブラウザは同一originの次のendpointだけを呼ぶ。

```http
GET /api/user
```

本番ではSPA Node serverが`API_URI`の`/api/user`へserver-side fetchし、次のheaderを付ける。

```http
Authorization: Bearer <API_TOKEN>
Accept: application/json
```

fetchは`redirect: 'error'`を明示し、redirect先へAuthorizationを送らない。Vite dev serverではproductionと同じproxy fetch関数を使って既存APIへ転送する。ブラウザから既存APIへ直接tokenを送らない。

### URL parsing and API dispatch

serverはHTTP request targetを次の順で1回だけ処理し、`new URL()`のpath正規化や複数回decodeへ依存しない。

1. raw targetが`/`で始まり`//`で始まらないことを確認する。不正なら400。
2. queryとfragmentをraw pathnameから分離する。static assetではquery/fragmentを無視する。API endpointはquery/fragment付きの`/api/user`を400とする。
3. `decodeURIComponent`を一度だけ適用し、malformed percent、NUL、backslash、`..` segmentがあれば400。
4. decoded pathnameの先頭segmentが大文字小文字を問わず`api`で始まる場合（`api`そのものだけでなく`apiary`も含む）はreserved API namespaceとする。raw targetが正確に`/api/user`で、decoded pathnameも正確に`/api/user`のときだけproxyへdispatchする。それ以外（`/api%2Fuser`、`/%61pi/user`、`/api%252Fuser`、`/api/unknown`、`/apiary`など）は404とし、SPA fallbackしない。malformed percentなどstep 3の400が先に適用される。
5. reserved namespaceでないpathだけをstatic file解決へ渡す。

### Upstream success example

既存TypeSpecの`GET /api/user`契約に従い、成功応答は次の形である。

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

proxy側でruntime validationを完了し、validな200応答だけを同じschemaのJSONへ再serializeしてbrowserへ返す。契約に合わない200応答は固定の502応答へ置き換え、raw bodyをbrowserへ渡さない。コンパイル時の型は`shared/src/schema`の生成型から導出し、同じobject shapeを手書きで再宣言しない。

`count`は`user.length`と一致しなければinvalidとする。current API実装がcountを取得件数として返すため、pagination等の別意味は導入しない。

### UI outputs

1. **Loading**: `Hub 問い合わせ中`相当の控えめな状態と、`--`を表示する。mainへ`aria-busy="true"`を設定する。
2. **Success / non-empty**:
   - headerに`Service Template`と`API ONLINE`を表示する。
   - summary cardにAPIから取得した`count`を大きく表示し、ラベルは`登録ユーザー`とする。
   - user cardに`user`の各行（名前、ID、作成日時、更新日時）を表示する。
3. **Success / empty**: `count === 0`かつ`user.length === 0`の場合、空状態カードに`--`と「ユーザーがありません」を表示する。
4. **Failure**:
   - headerに`API OFFLINE`を表示する。
   - 中央の状態カードに`OFFLINE`と「Service APIへ接続できません」を表示する。
   - token未設定、upstream非2xx、network failure、timeout、response size超過、redirect、JSON parse失敗、JSON shape不正を、tokenやupstream bodyを漏らさず同一の利用者向けエラー表示へ集約する。

status表示は`role="status" aria-live="polite"`、failure表示は`role="alert"`を使い、色だけに依存しない。

このサンプルはReact Routerの初回`clientLoader`から1回だけ取得する。手動refresh、定期refresh、編集、ページ遷移、chart、account/bucket/meterは実装しない。React StrictMode下でもfetchをcomponent effectに置かないため、初回navigationのloader requestは1回である。明示的なrevalidate操作も行わない。

### Timestamp display

`created_at`と`updated_at`はTypeSpecのdocに従うUnix timestamp secondsとする。0以上のsafe integerで、`Date`が表現できる範囲だけをvalidとする。表示は`Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })`で行い、末尾に`JST`を付ける。invalid valueに対するformat関数の`--`はproxyを迂回して関数を直接呼ぶ場合のdefensive fallbackであり、proxy経由のinvalid responseは画面へ到達せずfailureになる。

## Data Model

永続化は行わない。ブラウザで扱う型は、既存API契約から次のように導出する。

```typescript
schema.paths['/api/user']['get']['responses']['200']['content']['application/json']
```

runtime validationには`zod/mini`を使う。`id`、`count`、timestampの数値範囲、`name`のstring、`user`の配列、および`count === user.length`を検証する。

- `count`と`id`は0以上のsafe integer。
- timestampsは0以上のsafe integerで、`new Date(seconds * 1000)`がvalidとなる範囲。
- `name`は空文字も既存API契約上は受理する。表示時は文字列をそのままtext nodeへ渡し、HTMLとして解釈しない。

## Tech Stack

- React 19
- React Router v7 Framework Mode
- Vite Plus（既存rootの`vite-plus`およびVite overrideを利用）。rootの`vite` overrideはVite Plus coreへ解決されるため、SPAの標準Vite CLIは`vite-cli: npm:vite@^8.2.2` aliasで分離し、`npm run dev`の`vite` binへ接続する。`@react-router/dev`のVite peerは8.2.2、`vite-node`のVite dependencyは7.3.6へrootのscoped overrideで固定し、npm依存木をvalidに保つ。
- TypeScript
- Node.js組み込み`node:http`による静的asset配信server
- `zod/mini`による外部API応答validation
- npm workspaces

### Technical investigation

方式は次の既存実装・契約を確認して決定した。

- `limit-monitor/packages/client/package.json`: React Router v7、React 19、`ssr: false` SPA、Node配信serverの構成。
- `limit-monitor/packages/client/react-router.config.ts`: `ssr: false`と`buildDirectory: 'dist/spa'`の設定。
- `limit-monitor/packages/client/src/server/static-server.ts`: static asset、SPA fallback、path traversal拒否、GET/HEAD制限、cache controlの実装。
- `service-template/packages/shared/typespec/user.tsp`: 既存API`GET /api/user`の認証header、200/401/500応答、`count`/`user` response shape、Unix timestamp secondsのdoc。
- `service-template/packages/api/src/lib/middleware.ts`: `Authorization` headerが必須で、Bearer tokenの検証を行う実装。
- `service-template/packages/client/src/app/proxy/api/[...path]/route.ts`: 現行Next.jsがserver-sideでsession cookieを読み、APIへAuthorizationを注入する実装。SPAではこのhttpOnly cookieをbrowserから直接利用できないため、同じ安全境界をNode server-side proxyで維持する。

上記から、browser bundleへ`VITE_API_TOKEN`を埋め込む方式や、API responseに存在しないmeter値の生成は採用しない。

## Interface

### Repository/package

- 新規workspace: `packages/spa`
- 既存`packages/client`は併存させる。
- package script:
  - `dev`: React Router/Vite dev server。`/api/user`はproductionと同じsanitize済みdev proxyを使う。
  - `pretsc`: `shared` build（fresh checkoutでも生成schema型を用意する）
  - `tsc`: React Router typegen + TypeScript noEmit
  - `build`: SPA client buildとNode配信server buildを`dist/public` / `dist/server`へ出力
  - `start`: `dist/server/index.js`を起動
  - `test`: Vite Plus test
  - `format` / `format-check`
  - `lint` / `lint-fix`

### Routes and server behavior

- React Routerのapplication routeは`/`の1画面だけ。static serverが`/dashboard`などのextensionless pathへindex.htmlを返すのはtransport fallbackのテスト対象であり、サポートするapplication routeとは扱わない。
- 静的serverは`GET` / `HEAD`だけを受理する。authority検証はrouting前に行う。
- `/api/user`はGET専用のserver-side proxy endpointとする。`HEAD /api/user`はupstreamへ接続せず405と`Allow: GET`を返す。その他の`/api` namespaceは404とし、SPA fallbackしない。
- Vite dev middlewareでeffective authorityを取得できない間、static targetはViteへ継続するが、malformed targetは400、reserved API targetは固定503（`Development server is not ready\n`）として`next()`へ流さない。
- proxy successはvalidなupstream JSONだけを200で返す。missing tokenは503、upstream非2xx・network failure・timeout・redirect・response size超過・malformed/invalid shapeはすべて固定bodyの502とする。upstreamのstatus/bodyはbrowserへ転送しない。
- proxy fetchは`redirect: 'error'`を使い、monotonic clock（`performance.now()`）によるabsolute deadlineをfetch直前に開始する。response headers受領、decoded body全量読込、size check、JSON parse、schema validation、serializeの各段階の前後でdeadlineを確認し、完了時刻がdeadlineを超えていれば200にせず502とする。deadline超過時はabortして502とする。browser requestのaborted/response closeおよびserver shutdown時はupstream fetchをAbortする。
- body上限はFetch response bodyがcontent decodingされた後にstreamから受け取るbytesへ適用し、`Content-Length`の有無に関係なくchunk単位で数える。許容境界は`1_048_576` bytes以下（limit-1、limitはvalid）とし、累計がlimit+1になるchunkは一切bufferへ追加せず直ちにabortして502とする。chunkがlimitを超えても超過部分を保持・browser転送しない。
- 拡張子のないpathは`index.html`へSPA fallbackする。ただし`/api` namespaceはURL parse後に除外する。
- 拡張子付きで存在しないassetは404とし、SPA fallbackしない。
- `..`、encoded traversal、backslash、NUL、protocol-relative URL、malformed percent encodingは400で拒否する。
- 静的distributionは起動後に外部writerが変更しないimmutableなtrusted release treeを前提とする。設定された`SPA_DIST_DIR`自身もsymlinkであってはならず、起動時に`lstat`で拒否する。serverは実行中のpath置換競合へのportableな保証を提供しない。起動時・request時にsymlinkを配信対象から除外し、canonical root/fileがroot配下であることを確認し、最終file openでは`O_NOFOLLOW`相当を使う。事前に作られた中間directory/file symlinkは400/404とし、root外の実体を返さない。
- authority不一致は400固定body、API requestのOrigin不一致は403固定bodyとし、どちらもproxy/static処理へ進まない。
- 拡張子とContent-Typeの対応は次のとおりとする: `.html`=`text/html; charset=utf-8`、`.js`/`.mjs`=`text/javascript; charset=utf-8`、`.css`=`text/css; charset=utf-8`、`.json`/`.map`=`application/json; charset=utf-8`、`.svg`=`image/svg+xml`、`.png`=`image/png`、`.jpg`/`.jpeg`=`image/jpeg`、`.gif`=`image/gif`、`.webp`=`image/webp`、`.ico`=`image/x-icon`、`.woff`=`font/woff`、`.woff2`=`font/woff2`、`.ttf`=`font/ttf`、`.wasm`=`application/wasm`、`.webmanifest`=`application/manifest+json`、未知拡張子=`application/octet-stream`。
- hashed asset（`assets/`配下）は`public, max-age=31536000, immutable`、`index.html`とAPI応答は`no-store`とする。全レスポンスに`X-Content-Type-Options: nosniff`を付ける。

### Endpoint/method/status/header matrix

| Precedence/request | Condition | Status | Required headers/body |
| --- | --- | --- | --- |
| any request | Host missing, duplicated, comma-joined, or not the exact configured authority | 400 | `content-type: text/plain; charset=utf-8`, `cache-control: no-store`, `x-content-type-options: nosniff`, body `Bad Request\n` |
| any request with Origin | Origin duplicated, comma-joined, or not the exact `http://<configured-authority>` | 403 | same headers, body `Forbidden\n` |
| any request | malformed target, protocol-relative target, malformed percent, NUL, backslash, or `..` segment | 400 | same fixed-error headers, body `Bad Request\n` |
| dev reserved API target | effective Vite dev authority is unavailable | 503 | same fixed-error headers, body `Development server is not ready\n`, no `next()` |
| `GET /` | valid authority, index exists | 200 | HTML MIME, `cache-control: no-store`, `nosniff`, index body |
| `GET /dashboard` | valid authority, extensionless transport fallback | 200 | index HTML, `no-store`; application route support is out of scope |
| `GET /assets/app-abcdef.js` | existing asset | 200 | JS MIME, immutable cache, `nosniff`, asset body |
| `GET /assets/missing.js` | missing asset | 404 | same headers, body `Not Found\n` |
| `GET /api/user` | valid authority, no Origin or matching Origin, token + valid upstream | 200 | `content-type: application/json; charset=utf-8`, `cache-control: no-store`, `nosniff`, reserialized JSON |
| `GET /api/user` | missing or whitespace-only token | 503 | same fixed-error headers, body `API token is not configured\n` |
| `GET /api/user` | any upstream/proxy validation failure | 502 | same fixed-error headers, body `Bad Gateway\n` |
| `GET /api/user?x=1` | query is not part of endpoint | 400 | same fixed-error headers, body `Bad Request\n`, no upstream call |
| `GET /api/unknown`, `/api%2Fuser`, `/%61pi/user`, `/api%252Fuser`, `/apiary` | reserved namespace but not exact endpoint | 404 | same fixed-error headers, body `Not Found\n`, no SPA fallback |
| `HEAD /api/user` | valid authority/origin | 405 | `allow: GET`, fixed-error headers, empty body, no upstream call |
| `POST /api/user` | valid authority/origin | 405 | `allow: GET`, fixed-error headers, body `Method Not Allowed\n`, no upstream call |
| `POST /` | valid authority/origin, unsupported method | 405 | `allow: GET, HEAD`, fixed-error headers, body `Method Not Allowed\n` |
| static `HEAD` | same lookup as corresponding static GET | corresponding GET status | same headers, empty body |
| any path | preexisting symlink in root or traversed component | 400 | same fixed-error headers, body `Bad Request\n` |

`cache-control: no-store` and `x-content-type-options: nosniff` are required on every fixed error. Fixed bodies include the trailing newline and are never derived from upstream errors. `Origin` mismatch is checked for static and API requests alike.

### Deterministic UI test fixtures

`DashboardView`はloaderの実データとは独立して、次のfixtureをpropsとして直接受け取れる純粋な表示単位に分ける。

- loading: `HydrateFallback`を直接renderする。
- success: `ok: true`、`count: 2`、Alice/Bobのexample response。
- empty: `ok: true`、`count: 0`、`user: []`。
- failure: `ok: false`、`status: 502`、bodyは`Bad Gateway`（表示では固定offline文言のみ）。

Vite Plus test + Testing Libraryで、4 fixtureそれぞれの必須文言、`role="status"`/`role="alert"`、`aria-busy`、count/user rowの有無をassertする。`clientLoader`はfetch spyを1回だけ呼び、React componentのuseEffectは使用しない。styles testでhex値、breakpoint、必須class/レイアウト宣言を確認する。live browserのviewport計測は成功fixtureを返す一時upstream serverを`API_URI`に指定して実行し、390px/1280px時の`scrollWidth <= clientWidth`、content width `<= 960px`、required header/status/summary/user-card arrangementをCSS computed valuesとselectorで確認する。loading/empty/failureの状態選択はTesting Library fixtureで決定的に行う。live browser検証で使用する一時upstreamはloopback bind・固定JSON・固定portまたは動的portを使い、既存APIや外部networkへ接続しない。

## Error Handling

- fetch例外、timeout、redirect拒否、response size超過: server proxyは502固定body、browserはoffline表示。
- `API_TOKEN`未設定: production/dev proxyとも503固定body。token値はレスポンスへ含めない。
- upstream非2xx: server proxyは502固定body。upstream status/bodyはbrowserへ転送しない。
- upstream 200のJSON parse失敗、schema validation失敗、count/user length mismatch、invalid number/date: server proxyは502固定body。
- static path不正・traversal・拒否symlink: 400または404。dist外のfileを返さない。
- unsupported method: 405と`Allow` headerを返す。
- invalid `API_URI`、invalid `PORT`、non-loopback `HOST`、missing/non-directory `SPA_DIST_DIR`: 起動時に失敗する。
- index.html欠落: 起動時に失敗。runtime request時のfixture serverでは404。

## Non-functional Requirements

- API tokenはclient bundle、HTML、console log、access log、error bodyへ出さない。
- Node serverはloopback bind、Host exact allowlist、optional Origin exact allowlistだけを使い、外部公開やCORSを設定で有効化できない。
- 外部APIのデータ件数に比例するnetwork callを行わず、初回navigationの`GET /api/user`を1回だけ呼ぶ。
- upstream fetchはfetch開始からvalidation完了まで5秒でabortし、content-decoded bodyを1MiBを超えて保持しない（1MiBちょうどは許容）。client disconnectとSIGTERMでもactive fetchをabortする。
- UIは既存API応答が長くなっても横方向へはみ出さず、small viewportで1列へ縮退する。
- static path解決はraw path / decoded path / canonical pathを検証し、immutable tree内のsymlinkを配信しない。
- 新規packageのCIでlint、typecheck、shared build、spa build、testを実行する。

## Visual acceptance tokens

- background: `#101418`
- panel: `#1a2027`
- panel border: `#2a323c`
- primary text: `#e6ebf0`
- muted text: `#8b98a5`
- online: `#34c176`
- offline/error: `#e5534b`
- page max width: `960px`
- page padding: `16px`
- panel radius: `12px`
- card gap: `16px`
- mobile-to-grid breakpoint: `640px`

At viewport width 390pxはheader・summary・user rowsが横overflowせず1列、1280pxではcontent widthが960pxを超えないことをlive browserの`document.documentElement.scrollWidth <= document.documentElement.clientWidth`とcontent elementの`getBoundingClientRect().width <= 960`で確認する。loading、success、empty、offlineの4状態ではdeterministic fixtureによる必須文言・ARIA属性と上記token値を確認する。

## Out of Scope

- Next.js `packages/client`の置換・削除・リファクタリング。
- 新しいTypeSpec endpoint、API schema、DB schema、migration。
- service-templateの認証provider変更。
- browserへtokenを露出する方式。
- LAN/public bind、proxy caller認証、CORS、production deploy。
- 本物のlimit-monitor Hub、account、bucket、remaining percentage、reset time、chart。
- refresh操作、ユーザー編集、ページ遷移、永続化。
- 実行中distributionを外部writerが置き換えた場合のrace-free filesystem保証。

## Acceptance Criteria

- [x] `packages/spa`がnpm workspaceとして認識され、`packages/client`と併存する。
- [x] `packages/spa`にNext.js依存、Next.js設定、Next.js API routeが存在しない。
- [x] React Router v7 + Viteの`ssr: false` SPAとして`npm run build -w spa`が成功し、`dist/public/index.html`と`dist/server/index.js`が生成される。
- [x] `npm run dev -w spa`でSPAを起動でき、loopback Vite dev proxy経由で`GET /api/user`を呼べる。missing token/upstream errorのdev responseはproductionと同じsanitize contractを使い、effective authority未取得時のreserved API targetは固定503でfail-closedになる。
- [x] production serverが`/api/user`だけをserver-side proxyし、`API_TOKEN`をbrowserへ渡さない。non-loopback HOST、Host authority不一致、Origin不一致を拒否する。
- [x] proxyがredirectを拒否し、fetch開始からvalidation完了まで5秒deadline、decoded streamed body 1MiB上限、client disconnect/shutdown cancellationを適用する。
- [x] valid success responseだけがbrowserへ再serializeされ、non-2xx/raw invalid responseが漏れない。`count !== user.length`は502になる。
- [x] success responseの`count`/`user`、empty response、upstream failure、network failure、invalid response shapeがdeterministic fixture/API testに対応するUI状態として表示される。
- [x] `limit-monitor`由来のdark dashboard方向性を、Visual acceptance tokens、4状態、390px/1280pxのlive browser計測で確認できる。
- [x] static serverのSPA fallback、asset 404、path traversal拒否、unknown/encoded `/api`拒否、preexisting symlink拒否、method制限、content type/cache control、Host/Origin制限をendpoint matrixどおりテストで確認できる。
- [x] `npm run lint -w spa`、`npm run tsc -w spa`、`npm run build -w shared`、`npm run build -w spa`、`npm run test -w spa`が成功する。
- [x] `ci-spa.yml`が次のpathを監視する: `.github/workflows/ci-spa.yml`、`packages/spa/**`、`packages/shared/**`、`package.json`、`package-lock.json`、root `vite.config.ts`、`lint-rules/**`。workflowは`npm ci`、spa lint、shared build、spa tsc、spa build、spa testを順に実行する。spaの`pretsc`も単体実行時のfresh checkoutを成立させるためshared buildを行う。
- [x] root workspace/lockfile変更が既存clientへ影響するため、`ci-client.yml`も`package-lock.json`をtrigger pathへ含め、既存のclient lint、shared build、client build、client testを実行する。spa追加だけでclientの既存contractを黙って省略しない。
- [x] 変更前から存在する`packages/client`のlint/build/test契約を壊さない。

## Assumptions

- package名`spa`、既存Next.js packageとの併設、React Router + Vite、Node static serverはユーザー選択に基づく。
- ユーザーは「service-templateの既存APIへ接続」を選択したため、表示データは既存`/api/user`の`count`/`user`に限定する。limit-monitorのmeterを再現するためのAPI拡張は要求されていない。
- Authorization方式とデータ対応付けの追加確認は2回タイムアウトしたため、安全側の実装としてloopback-only、Host/Origin allowlist、server-side `API_URI` + `API_TOKEN` proxyを採用する。browser bundleへtokenを埋め込まない。
- 「見た目だけの静的1画面」は、画面を1ページに限定し、refreshや編集などの操作を追加しない意味で解釈する。ただし、初回表示時の既存API GETとloading/success/empty/error状態の描画は、先に選択されたAPI接続要件を満たすため実装する。
- distributionの実行中変更は運用上禁止されたimmutable release treeを前提にする。`SPA_DIST_DIR`自身もsymlink不可で、起動時にnon-symlink directoryとして固定する。serverは外部writerとの同時変更を保護するfilesystem primitiveを提供しない。request時のsymlink拒否は起動後に事前配置されたtreeに対して保証し、同時置換競合はsupportしない。

## Adversarial Review

### Round 1

- artifact: `docs/spec/reviews/spa-sample-round1.json`
- reviewer: GPT-5 Codex（CLI指定`gpt-5.6-sol`、runtime capability tier非公開）
- model relationship: unknown
- qualified gate: Pending（identity/tierの十分な証明なし）
- result: Blocking 1、Major 11。全指摘を改訂版へ反映した。

### Round 2

- artifact: `docs/spec/reviews/spa-sample-round2.json`
- reviewer: `gpt-5.6-sol`（runtime report）
- capability tier: not exposed
- model relationship: unknown
- qualified gate: Pending（author modelとの能力関係がruntimeで証明されていない）
- result: Blocking 2、Major 4。全指摘を本改訂版へ反映した。

### Round 3

- artifact: `docs/spec/reviews/spa-sample-round3.json`
- reviewer: `gpt-5.6-sol`（runtime report）
- capability tier: not exposed
- model relationship: unknown
- qualified gate: Pending（能力関係の証明なし）
- result: Blocking 2、Major 7。指摘を本改訂版へ反映した。原文verdictは修正前revisionの証跡として保存している。

### Round 4 / final closure

- artifact: `docs/spec/reviews/spa-sample-round4.json`
- reviewer: `gpt-5.6-luna`
- capability tier: runtime (not exposed)
- model relationship: `Fallback: equivalent reviewer`（author modelと同一モデルをfresh独立contextで実施）
- 対象: CI順序修正後の本仕様書
- 判定: **Passed**
- Blocking: 0、Major: 0、Minor: 0、Invalid: 0
- transcript: `/home/koh110/.hermes/cache/delegation/live/deleg_bc68c7f6/task-0.log`

## Implementation Review

- final closure artifact: `docs/spec/reviews/spa-sample-code-review-round4.json`
- reviewer: GPT-5 Codex（capability tier: primary）
- result: **Passed**（Blocking 0、Major 0、Minor 0、Invalid 0）
- closed findings: M-001（dev proxy fail-closed）、M-002（security boundary/limit/cancellation test coverage）、m-001（ASCII-only token trim）
