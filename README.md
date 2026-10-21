# Comic Shelf

本地漫画书架。添加本地目录为资源库，自动扫描漫画/章节/图片并存入 SQLite。

漫画存放规范：[docs/comic-storage-spec.md](docs/comic-storage-spec.md)

## 技术栈

- 后端：Node.js 22 + Fastify 5 + better-sqlite3（`server/`）
- 前端：React 19 + Vite + React Router（`web/`）
- 数据库：`data/comic-shelf.db`（首次启动自动创建）

## 运行

```bash
npm install
npm run dev        # 开发：前端 http://localhost:5173，后端 :10101
npm run build && npm start   # 生产：http://localhost:10101
```

首次启动自动创建管理员 `comic`，随机初始密码打印在控制台（Docker 下用 `docker logs comic-shelf` 查看）。

重置密码（会同时注销所有已登录设备）：

```bash
node reset_pass.js <新密码>                                  # 本地
docker exec comic-shelf node reset_pass.js <新密码>          # Docker
```

## Docker 部署

```bash
docker compose up -d --build   # 构建镜像并启动，http://<主机>:10101
```

- 漫画资源 `/volume1/xmedia` 只读挂载到容器 `/data`，网页添加资源库时填容器内路径，如 `/data/漫画`
- 数据库持久化到 `/volume1/docker/ss/data`（挂载为容器内 `/app/data`）
