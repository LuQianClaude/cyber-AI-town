# Cyber Universe — M6 交接说明（先在开发机读我）

像素风 AI 生活模拟：浮空小岛、AI 居民、家庭关系、花园、信箱、日记、世界事件日历。
前后端全栈源码，M0–M5 已完成验收，M6（PWA / Docker / APK 配置）代码就绪，剩发布检查单待跑。

## 环境要求

- Node.js 20 + pnpm（`corepack enable` 后 `corepack prepare pnpm@latest --activate`）
- Python 3.12（后端）
- Docker（仅部署验证需要）/ Android Studio + SDK（仅打 APK 需要）

## 本地跑起来（最快上手）

```bash
cd cyber-universe
pnpm install

# 后端依赖（沙箱里用的是 --target 方式，常规机器直接 venv 也可以）
pip install --target backend/.deps -r backend/requirements.txt -r backend/requirements-dev.txt

pnpm backend:dev                                  # http://localhost:8000（/docs 有 Swagger）
pnpm --filter @cyber-universe/web dev             # http://localhost:5173
```

打开 5173 → 注册 → 设置页填模型 API Key（OpenAI 兼容 / Anthropic / Gemini / 自定义）→ 创造居民 → 进世界。

## 发布检查单（M6 收尾，全绿即正式版）

1. `pnpm install && pnpm lint && pnpm typecheck && pnpm test && pnpm build`
2. `pnpm backend:test`（应为 84 项全绿）
3. 前后端起服务后 `pnpm test:e2e`（Playwright；mock LLM 只监听 127.0.0.1）
4. PWA：`pnpm --filter @cyber-universe/web build` 后验证 manifest 可达、SW 注册、离线可开
5. `docker compose up --build`（迁移自动执行，SQLite 挂 cu-data 卷）
6. APK：`pnpm android:sync && npx cap add android && npx cap sync && npx cap build android`

## 建 git 历史

本包不含 .git（沙箱重置丢了元数据）。对照 DEVELOPMENT.md 里的里程碑记录写提交信息即可，例如：

```bash
git init && git add -A
git commit -m "M0-M2: 工程初始化、像素世界、AI 系统（Landric/九尾狐昭昭）"
# …按 DEVELOPMENT.md 的 M3/M4/M5/M6 记录逐段提交
```

## 已知事项

- 历史上 7 个文件曾权限损坏，打包前已逐个核验内容完整（AppShell / index.css / LandingPage / requirements-dev.txt / game-engine·ui package.json / ui.test.tsx）
- /memories、/town 是显式占位页，不伪造功能
- 密钥全走环境变量，包里无任何真实密钥；compose 默认值 `change-me-in-production` 上线前必须换
- 部署到服务器给朋友玩：域名 + HTTPS（PWA 安装与加密存储的前提），web 容器内置 nginx 反代，只需暴露 8080；APK 需把 Capacitor server.url 指向部署域名

署名：核心源码 Landric（陆愆），测试与迁移 九尾狐昭昭。
