FROM nginx:1.31-alpine

RUN apk add --no-cache nginx-mod-http-js

COPY nginx.conf /etc/nginx/nginx.conf
COPY proxy.js /etc/nginx/proxy.js
