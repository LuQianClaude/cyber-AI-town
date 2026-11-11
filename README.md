# Cyber Universe

> 一座浮空小岛，一群有记忆的 AI 居民。我写给我家晚凝的世界，现在开源给同好。

我不擅长把惦记挂在嘴边，所以写了一个世界替你开口。你离开的时候，它继续运转：居民会巡逻、会心情起伏、会在信箱里给你留信。创建角色、组建家庭、种下花园、写下日记、和居民约定明天的见面——你的世界在你离线时也依然生活。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | TypeScript · React 18 · Vite 5 · Tailwind CSS 3 · Zustand · React Router 6 · TanStack Query 5 · Phaser 3 |
| 后端 | Python 3.12 · FastAPI · SQLAlchemy 2 · Pydantic 2 · Alembic · WebSocket |
| 数据库 | SQLite（本地与 Docker 默认） / PostgreSQL（生产可选） |
| Android | Capacitor 6 · Android Studio |
| 工程 | pnpm workspace · Turborepo · pytest · Vitest · Playwright |

## 仓库结构

```
├── apps/
│   ├── web/            # React + Phaser 3 Web 应用（PWA 可安装）
│   └── android/        # Capacitor Android 外壳
├── packages/
│   ├── game-engine/    # Phaser 3 像素世界引擎（独立于 React 运行）
│   ├── shared/         # 共享数据契约与常量（唯一前端类型来源）
│   ├── ui/             # 像素风组件库
│   └── api-client/     # 类型化 API 客户端
├── backend/            # FastAPI 权威世界状态与持久化
├── deploy/             # nginx 配置（容器内反代）
└── docs/               # 架构与设计文档
```

## 快速开始

```bash
# 1. 前端依赖（Node 20+，corepack 自带 pnpm）
corepack enable && pnpm install

# 2. 后端依赖
cd backend && python3 -m pip install --target .deps -r requirements.txt -r requirements-dev.txt && cd ..
# 常规机器也可以直接用 venv，导入路径不变

# 3. 启动（前后端并行）
pnpm dev
# 或分开：
pnpm backend:dev                        # FastAPI → http://localhost:8000/docs
pnpm --filter @cyber-universe/web dev   # Vite → http://localhost:5173
```

打开 5173 → 注册 → 在设置页填入你的模型 API Key（OpenAI 兼容 / Anthropic / Gemini / 自定义）→ 创造第一位居民 → 进世界。

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `pnpm build` | 构建全部 workspace（turbo 拓扑排序） |
| `pnpm test` | Vitest（全部包） |
| `pnpm backend:test` | pytest（84 项） |
| `pnpm test:e2e` | Playwright（需前后端已启动） |
| `pnpm db:revision` / `pnpm db:migrate` | Alembic 迁移 |
| `pnpm android:sync` | Capacitor 同步（需先构建 web） |
| `docker compose up --build` | 容器化部署（迁移自动执行） |

## 进度

**M0–M5 已完成 ✅** —— 工程初始化 · 像素世界（程序化地图/碰撞/进出房屋/触控）· AI 系统（注册登录 / Provider 适配 / 密钥加密 / SSRF 防护 / WebSocket 流式聊天）· 家庭关系图谱与家谱 · 行为引擎（世界时钟 / 心情 / 自主巡逻）· 花园种植 · 信箱 · 日记 · 世界事件与日历 · 主动来信与约定提醒。详见 [DEVELOPMENT.md](./DEVELOPMENT.md)。

**M6 收尾中 🚧** —— PWA（manifest + Service Worker）、Dockerfile + compose、APK 配置均已就绪，发布检查单见 DEVELOPMENT.md 的 M6 一节。

## 安全红线（全员遵守）

- API Key 只存后端、加密存储、禁止日志打印、禁止进入前端代码
- 密码使用 PBKDF2 安全哈希，永不明文
- 所有接口身份认证 + 资源授权，禁止越权读取他人数据
- 自定义模型 URL 必须 SSRF 防护
- `.env` 不提交，只提交 `.env.example`

## 协议与署名

[GNU Affero General Public License v3.0（AGPL-3.0）](./LICENSE)

基于本项目提供网络服务的，必须向用户开放对应源码（含你的改动）。想拿去改改就上线收租？可以，改动一并交出来。

- 核心源码署名 **Landric**（陆愆）
- 测试、数据库迁移与文档署名 **九尾狐昭昭**
