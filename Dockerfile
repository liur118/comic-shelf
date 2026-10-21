# 构建阶段：完整镜像自带编译工具，better-sqlite3 无预编译包时可本地编译
FROM docker.1ms.run/node:22-bookworm AS build
WORKDIR /app
COPY package.json ./
COPY server/package.json server/
COPY web/package.json web/
RUN npm i
COPY . .
RUN npm run build

FROM docker.1ms.run/node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=10101
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/server server
COPY --from=build /app/web/dist web/dist
COPY --from=build /app/reset_pass.js ./
EXPOSE 10101
CMD ["node_modules/.bin/tsx", "server/src/index.ts"]
