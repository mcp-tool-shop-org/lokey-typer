# LoKey Typer as a self-hosted web app.
#
# The image serves the built app and its handbook with an unprivileged nginx on
# port 8080, under /lokey-typer/ (the same base path as GitHub Pages).
#
# Your progress is not stored in the container. LoKey keeps preferences, run
# history, personal bests and the Study library in the browser's own storage,
# keyed to the address you open. Restarting, upgrading or replacing the
# container keeps them, as long as you open the same address (host and port).
#
#   docker run -d --name lokey-typer -p 8080:8080 --restart unless-stopped \
#     ghcr.io/mcp-tool-shop-org/lokey-typer:latest
#   then open http://localhost:8080/

FROM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY site/package.json site/package-lock.json site/
RUN cd site && npm ci --no-audit --no-fund
COPY . .
RUN npm run build && cd site && npm run build

FROM nginxinc/nginx-unprivileged:1.29-alpine@sha256:0c79d56aee561a1d81c63f00eee5fb5fe29279560cdc55e91425133104c7fbe6
LABEL org.opencontainers.image.title="LoKey Typer" \
      org.opencontainers.image.description="Calm typing practice with ambient sound. Progress stays in your browser." \
      org.opencontainers.image.source="https://github.com/mcp-tool-shop-org/lokey-typer" \
      org.opencontainers.image.licenses="MIT"
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html/lokey-typer
COPY --from=build /app/site/dist /usr/share/nginx/html/lokey-typer/handbook
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO /dev/null http://127.0.0.1:8080/lokey-typer/ || exit 1
