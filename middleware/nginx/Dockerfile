# 公式 image は nginx.org の nginx-module-njs（ngx_http_js_module.so）を同梱している。
# Alpine の nginx-mod-http-js は nginx.org の nginx と衝突して入らないため追加しない。
FROM nginx:1.31.9-alpine

COPY nginx.conf /etc/nginx/nginx.conf
COPY proxy.js /etc/nginx/proxy.js
