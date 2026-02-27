FROM nginx:1.27-alpine

RUN apk add --no-cache nginx-mod-http-js

COPY nginx.conf /etc/nginx/nginx.conf
COPY proxy.js /etc/nginx/proxy.js
