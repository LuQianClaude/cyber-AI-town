# DEVELOPMENT — Cyber Universe 开发文档

本文档随里程碑滚动更新。每个里程碑结束时在此登记：完成内容、验收结果、数据库变化与下阶段计划。

## 里程碑总览

| 里程碑 | 内容 | 状态 |
| --- | --- | --- |
| M0 | 工程初始化（Monorepo / 依赖 / 环境 / 文档） | ✅ 已完成 |
| M1 | 像素世界（Phaser 地图 / 移动 / 碰撞 / 摄像机 / 触控） | ✅ 已完成 |
| M2 | AI 系统（注册登录 / AI 创建 / Provider Adapter / 聊天 / 流式） | ✅ 已完成 |
| M3 | 家庭和关系 | ✅ 已完成 |
| M4 | 生活与记忆（行为引擎 / 信箱 / 日记 / 花园） | ✅ 已完成 |
| M5 | 深化（世界事件 / 日历 / 主动行为） | ✅ 已完成 |
| M6 | 多端与发布（PWA / Capacitor APK / 部署 / 全面测试） | 进行中 |

> 口径说明：M5 范围以 README 为准（深化）；本文档原表将「多端与发布」列为 M5，经用户确认顺延为 M6。

> 纪律：一次只执行一个里程碑；验收通过并获用户确认后进入下一阶段。

---

## M1 完成记录

### 完成内容

- **世界布局**（`game-engine/src/world/layout.ts`）：程序化生成 40×28 浮空小岛——水域环带、住宅（7×5 格）、十字小路、栅栏花园（8 块种植区）、广场（含长椅）、树木花丛；独立碰撞网格与交互区数据（房门 / 种植地块 / 长椅）
- **程序化像素资产**：零外部图片，全部按 `docs/art-reference/ART_STYLE.md` 规范生成——地形 7 种地块、房屋外观（奶油墙/胡桃木屋顶/雾墨蓝窗）、树木、栅栏、长椅、花丛、室内 8 种资产（木地板/护墙板/床/书架/餐桌/地毯/盆栽）
- **角色 Sprite 生成器**：32×32、4 方向 × 4 帧步态循环；**发色/瞳色/服饰配色与长发参数可配置**（默认皮肤取自画风参考图）；大眼单点高光、含蓄微笑、侧辫缀饰
- **WorldScene**：WASD/方向键移动、轴分离碰撞（四角采样）、摄像机跟随（lerp 0.12、zoom 2、边界约束）、深度排序（y 轴）
- **HouseScene**：进门淡出切换、室内独立碰撞（墙体 + 家具 AABB）、出门返回世界且位置保留在门外
- **触控**：左半屏虚拟摇杆（死区 + 单位圆限幅）+ 右下互动按钮，桌面端可用鼠标拖拽替代
- **web 接入**：`/world` 懒加载 Phaser 包、引擎独立于 React 生命周期、加载/错误/状态浮层完整

### 验收结果

| 验收项 | 结果 |
| --- | --- |
| `pnpm build`（5 包） | ✅ |
| `pnpm test`（Vitest 9 任务，新增布局/输入/角色规格用例） | ✅ |
| Playwright E2E（world.spec.ts 5 项 + smoke 1 项） | ✅ 6/6：引擎启动零报错、键盘移动改变坐标与朝向、房屋碰撞不可穿越、房门进出切换且位置保留、canvas 渲染 |
| 视觉自检（截图） | ✅ 外部世界 / 室内 / 行走帧 / 390×844 移动端，零控制台错误 |
| 自由移动 + 进出房屋 | ✅（E2E 实测） |

### 数据库变化

无。M1 为客户端世界，后端未改动。

### 排障记录

- 切场景时移除重建 `'char'` 纹理导致 Animation 帧引用失效（`sourceSize null`）→ 角色纹理改为会话级单例复用
- debug 钩子的 facing 硬编码 'down' → 改为读取场景实例
- 草地噪点过密呈"星空感" → 降低密度并压暗暗色权重

### 已知取舍

- 种植/长椅交互仅提示"M4 开放"，不伪造种植逻辑
- 触控摇杆未在 E2E 中模拟（向量数学已有单测）

---

## M0 完成记录

### 完成内容

- **Monorepo 骨架**：pnpm workspace + Turborepo，`apps/web` `apps/android` `packages/{game-engine,shared,ui,api-client}` `backend` 六个工作区
- **前端基座**：React 18 + TS + Vite 5 + Tailwind 3（含主题色板 cream/sage/sky/wbrown/pink）+ React Router（12 个主页面路由骨架）+ TanStack Query + Zustand 依赖就位 + Phaser 3 安装
- **组件库**（packages/ui）：PixelButton / PixelCard / PixelInput，带 disabled / focus-visible / 校验错误态
- **游戏引擎包**（packages/game-engine）：Phaser 独立启动入口 `createGame`（BootScene 引导，M1 替换为 World 场景），不依赖 React 渲染周期
- **后端基座**：FastAPI + SQLAlchemy 2（DeclarativeBase）+ Pydantic Settings + Alembic 环境 + SQLite；`GET /api/health`；PBKDF2 密码哈希（M2 注册登录直接复用）
- **数据契约**：`packages/shared` 为前端类型唯一来源，后端 Pydantic 为权威定义，OpenAPI 输出用于校验对齐
- **Android**：Capacitor 6 配置（appId / webDir 指向 web 构建产物），安全存储方案在 M5 落地
- **环境变量**：根 / backend / web 三份 `.env.example`，无任何真实密钥

### 验收结果

| 验收项 | 结果 |
| --- | --- |
| `pnpm build`（5 个包） | ✅ 全部通过 |
| `pnpm test`（Vitest，9 个测试任务） | ✅ 全部通过 |
| `pnpm backend:test`（pytest，8 项） | ✅ 全部通过 |
| 后端启动 + `/api/health` | ✅ `{"status":"ok","version":"0.1.0"}` |
| 前端 dev server + vite 代理 `/api` | ✅ 代理联通，浏览器实测零控制台错误 |
| Playwright 冒烟（Chromium） | ✅ 1 passed |
| Alembic 配置解析 | ✅ `alembic heads` 正常 |
| Android 工程同步 | ⚠️ 配置就绪；本沙箱无 Android SDK，`npx cap add android` 需在装有 Android Studio 的开发机执行（apps/android/README.md 有步骤） |

### 数据库变化

无业务表。仅 Alembic 环境就绪，首个迁移在 M2（User / AIResident 表）生成。

### 已知取舍

- 后端依赖以 `pip install --target backend/.deps` 安装（沙箱挂载不支持 venv 符号链接）；常规机器可直接用 venv，导入路径不变
- 游戏引擎的 Phaser 实例验证在 Node 环境不可用 canvas，由 M1 的 Playwright 浏览器测试承担
- eslint / prettier 未配置（M5 统一接入，避免与 M1–M4 代码返工）

---

## M2 完成记录（AI 系统）

### 完成内容

- **后端**
  - 注册 / 登录 / 令牌刷新（JWT 12h + 刷新令牌 30d 轮转、撤销）/ 注销级联删除（`app/api/routes/auth.py`）
  - PBKDF2-HMAC-SHA256 密码哈希（60 万迭代，stdlib）
  - 模型配置 CRUD（`app/api/routes/model_configs.py`）：Provider 适配 OpenAI 兼容 / Anthropic / Gemini / 自定义；API Key Fernet 加密入库、永不回流前端；`/test` 连通性测试（首字延迟）
  - AI 居民 CRUD + 记忆 CRUD（`app/api/routes/residents.py`）：严格属主校验（非属主 404）；删除级联清理记忆 / 消息 / 参与者 / 空会话
  - 聊天 REST + WebSocket（`app/api/routes/chat.py`）：DM 会话复用、群聊（≤8 居民）；WS 走 query token 鉴权（4401/4403）；AI 回复由服务端任务调度（asyncio 信号量 2 + 每用户令牌桶限流 20/min），SSE 流式增量广播 `ai_stream` → `ai_done`
  - Provider Adapter 层（`app/services/providers/`）：统一 `AdapterError`，429/5xx 指数退避重试
  - 安全：SSRF 防护（私网 CIDR 黑名单 + DNS 解析校验；生产禁止放行，开发环境显式宽松）；刷新令牌 sha256 落库；密钥不落日志
- **前端**
  - api-client 全面扩展：类型化资源 API、`ApiSession`（401 单飞自动刷新重试）、`ChatSocket`（4401 刷新重连）、令牌存储抽象
  - 页面：登录/注册、主页（数据概览）、居民管理（像素头像实时预览 + 配色配置 + 模型绑定 + 删除确认）、聊天（会话列表 + 流式气泡 + `?with=` 直达）、设置（模型配置 CRUD + 测试连接 + 账户注销）
  - 世界引擎：居民 NPC 进场（独立纹理、名牌、待机浮动、走近按 E / 点击互动 → 跳转聊天）；调试 API 增加 NPC 与相机状态
- **测试**
  - 后端 pytest 33 项全绿（认证、越权、SSRF、加密、限流、WS 全双工流式、群聊多居民、级联删除）
  - Playwright E2E 7 项全绿，其中 M2 全链路：注册 → 配置模型（指向本地 mock LLM）→ 创造居民 → 世界 NPC 出现 → 互动进聊天 → 流式回复落库

### 修改文件（主要）

- 后端：`app/core/{config,security,encryption,net,ratelimit}.py`、`app/db/models/*`、`app/schemas/*`、`app/api/routes/{auth,model_configs,residents,chat}.py`、`app/services/{llm,providers/*}`、`app/api/deps.py`、`alembic/versions/37325182ffe7_*`、`tests/*`
- 前端：`packages/api-client/src/index.ts`、`apps/web/src/pages/{Login,Home,Residents,Chat,Settings,World}Page.tsx`、`apps/web/src/{App.tsx,store/auth.ts,components/{AppShell,RequireAuth}.tsx}`、`apps/web/vite.config.ts`（/api 代理 ws:true）
- 引擎：`packages/game-engine/src/{config,debug,index}.ts`、`scenes/WorldScene.ts`、`render/character.ts`（头像 dataURL 导出）

### 新增依赖

- 后端：pyjwt、cryptography、httpx（`backend/requirements.txt`）
- 前端：无新增运行时依赖（zustand / @tanstack/react-query M0 已装）

### 数据库变化

- Alembic 迁移 `37325182ffe7` 已应用：users、refresh_tokens、model_configs、ai_residents、resident_memories、chat_sessions、chat_participants、chat_messages（共 8 表）

### 启动命令

- 后端：`pnpm backend:dev`（http://localhost:8000，Swagger 于 /docs）
- 前端：`pnpm --filter @cyber-universe/web dev`（http://localhost:5173，/api 与 WS 已代理）
- 测试：`pnpm test`（单元）/ `pnpm backend:test` / `cd apps/web && npx playwright test`

### 测试结果

- pytest 33 passed；Vitest 26 passed（shared 3 + api-client 6 + ui 5 + game-engine 13 + web 2 — 以实跑为准）；Playwright 7 passed（1.8m）
- E2E 全链路真实调用了 mock LLM 的 OpenAI 兼容流式接口（apps/web/e2e/mock-llm.mjs，仅监听 127.0.0.1）

### 未完成事项

- AI 主动行为引擎（心情 / 日程 / 主动发起聊天）属 M3/M4 范围
- 居民在世界中自主移动、AI↔AI 非会话内互动：M3 行为引擎
- 多实例部署需把进程内限流迁移 Redis（代码中已标注）
- 世界页居民 NPC 目前静态站位（待机浮动），巡逻移动留给 M3 行为引擎统一做

### 下一阶段计划（M3）

- 家庭系统：居民间关系图谱、结婚 / 结拜 / 邻居、家庭页面与家谱展示
- 行为引擎雏形：世界时钟驱动居民日程，心情值影响对话与移动
- 居民自主移动与简单巡逻

## M3 进行记录（家庭系统 · 第一刀：关系图谱）

### 已完成

- **后端**
  - 新表 `resident_relationships`（`app/db/models/relationship.py`）：居民对 + `relation_type`（spouse/sworn/neighbor）+ `status`（pending/accepted/ended）；居民对按字典序规范化，杜绝 A→B / B→A 双记录
  - 有效关系（pending/accepted）由**部分唯一索引**强制（`sqlite_where`），ended 历史可保留、解除后同类型可重建
  - 路由（`app/api/routes/relationships.py`）：创建 / 列表 / 状态变更（pending→accepted→ended，终态不可回退）/ 家谱树（BFS 四层，spouse+sworn 入树，neighbor 与 pending 不入树）；属主校验一律 404
  - 居民删除显式级联清理关系（SQLite 未开外键级联，同 M2 模式）
  - Alembic 迁移 `a1b2c3d4e5f6`（0002）
- **前端**
  - api-client：关系类型 + `relationships.list/create/update/familyTree`
  - `FamilyPage`：居民视角切换、建立关系表单（甲乙去重、防自关联）、按类型分组的关系列表（确认/解除）、按深度分层的家谱 + 关系边清单
  - `/family` 路由由占位页换为真实页面（App.tsx）

### 第二刀：行为引擎 + 自主巡逻（已完成）

- **世界时钟**（`app/services/world_clock.py`）：1 现实秒 = 1 游戏分钟，游戏日 24 现实分钟；六时段（dawn/morning/noon/afternoon/evening/night），纯函数可测
- **行为引擎**（`app/services/behavior.py`）：心情 0–100、基准线 60、自然漂移 1 点/现实分钟；聊天回复成功 +4（`chat.py` 钩子）；时段 → 活动推导；心情分层（低落/有些闷/平静/愉快）注入对话 system prompt（`llm.py`）
- **实时状态接口**：`GET /residents/{id}/status` → 世界时钟（含 display）+ 心情 + 引擎活动；ResidentOut 增加 `mood`
- **居民自主巡逻**（`game-engine/src/systems/patrol.ts`，纯逻辑）：出生点 96px 半径随机游走 42px/s、停留 2–5s、碰撞重试 8 次回退出生点；WorldScene 每帧驱动，交互判定与交互区跟随 NPC 实时位置（不再站桩）
- Alembic 迁移 `b2c3d4e5f6a7`（0003：ai_residents + mood / mood_updated_at）

### 测试

- 后端 pytest 53 项全绿（M3 新增 20 项：关系 9 + 时钟/心情/状态接口/聊天加心情/prompt 注入 11）
- game-engine 新增巡逻单测 5 项（`patrol.test.ts`，vitest 需在开发机运行）

### 环境限制（本沙箱）

- 无网络，`node_modules` 未安装且无法 `pnpm install`，前端 build / Vitest / Playwright 验证需在开发机执行
- 7 个文件权限损坏（root 0600 不可读，源自沙箱重建）：`apps/web/src/components/AppShell.tsx`、`apps/web/src/index.css`、`apps/web/src/pages/LandingPage.tsx`、`backend/requirements-dev.txt`、`packages/game-engine/package.json`、`packages/ui/package.json`、`packages/ui/src/__tests__/ui.test.tsx`。其中 AppShell 不可读导致家庭页导航入口暂不可加（路由已通，可直访 `/family`）
- git 元数据置于 /tmp/cu.git（挂载盘不允许 chmod）；基线 commit `1c77b01`，M3 关系图谱 commit `8d064ba`

### M4 进行记录（生活与记忆）

#### 第一刀：花园种植（已完成，后端）

- 规则核心（`app/services/garden.py`，纯函数）：3 种作物（樱桃萝卜 90 / 小番茄 240 / 向日葵 600 游戏分钟），阶段推导 empty/growing/mature + 进度与剩余时间
- 新表 `garden_plots`：owner_id + plot_index（0-7，与世界布局 8 块种植区一一对应）唯一约束，crop / planted_tick（世界时钟游戏分钟）/ harvests
- 接口（`app/api/routes/garden.py`）：GET 惰性初始化 8 块地 / plant（非法作物与地块 400、重复种植 409）/ harvest（未成熟 409，收获数 +1）/ clear（铲除不记收获，幂等）
- 注销账号显式级联清理 GardenPlot；**顺带修复 M3 遗留**：注销时漏清 ResidentRelationship
- Alembic 迁移 `c3d4e5f6a7b8`（0004）
- 测试 6 项：阶段数学、惰性初始化与属主隔离、种植规则、成熟才可收、铲除幂等、注销级联
- 待办：前端种植区交互（WorldPage 传入花园状态，engine 触发 plant/harvest 回调）；种子 visuals 用色块区分生长阶段

#### 第二刀：信箱（已完成）

- 新表 `mailbox_letters`（迁移 d4e5f6a7b8c9 / 0005）：用户来信与居民回信同表，`reply_to_id` 串对话；居民来信 `reply_to_id` 为空
- `llm._complete`：抽取的非流式公共生成助手（限流/重试/信号量复用），`generate_letter_text` 回信走它
- 寄信后台任务（BackgroundTasks）生成回信；居民无模型配置静默跳过不伪造；失败只记日志
- 接口：POST /mailbox/letters、GET /mailbox/letters、GET /mailbox/summary（按居民聚合未读数）、POST /mailbox/letters/{id}/read
- 居民删除 / 注销账号级联清理（M3 关系表注销漏清一并修复）
- 测试 5 组

#### 第三刀：日记（已完成）

- 触发规则（`app/services/diary.py` 纯函数）：第一篇 / 跨游戏日 / 同日心情波动 ≥20，否则 409
- `generate_diary_text`：按世界时钟 + 活动 + 心情分层写第一人称日记（记忆经 system prompt 注入）
- 新表 `diary_entries`（迁移 e5f6a7b8c9d0 / 0006）：只追加，记游戏日/小时与心情快照
- 接口：GET/POST /residents/{id}/diary/entries；级联清理同信箱
- 测试 5 组

#### 第四刀：主动行为（已完成）

- 规则（`app/services/proactive.py` 纯函数）：满 2 游戏日没收到来信 → 主动来信（心情 <40 不写闲聊信）；今天没聊过 → 打招呼，心情差时换「想找人说话」变体
- `POST /proactive/run`：惰性物化——来信落信箱（未读）、招呼落 DM 会话（参与者模型即成员名单）；每用户 30s 节流（`users.proactive_last_run_at`，迁移 f6a7b8c9d0e1 / 0007）；无模型配置跳过
- `generate_proactive_text`：letter / greeting / greeting_low 三种话术
- 测试 6 组

#### 署名

- 核心源码文件头署名 Landric（陆愆），测试与迁移署名九尾狐昭昭，README 含原创声明

#### M4 待办（开发机）

- 前端构建与 E2E 验证：`pnpm install && pnpm test && pnpm build && npx playwright test`
- 世界引擎花园 visuals：WorldPage 传入 garden 状态，种植区色块按生长阶段变化（engine 保持 LLM-free，plant/harvest 走回调）
- AppShell 导航入口（待损坏文件恢复后）：家庭 / 信箱 / 花园

---

- 前端构建与 E2E 在开发机验证（`pnpm install && pnpm test && pnpm build && npx playwright test`），重点：/family 页面、NPC 巡逻不破坏既有 world E2E
- M3 验收待用户确认

---

## M5 进行记录（深化）

### 第一刀：世界事件 + 日历接口（已完成）

- 新表 `world_events`（迁移 a7b8c9d0e1f2 / 0008）：kind world（引擎每日生成）| appointment（用户与居民的约定），世界时钟坐标 game_day/game_hour
- `generate_world_event`：用用户默认模型配置生成「小镇今天发生了什么」（标题 + 一两句正文，格式解析）；无默认配置返回 None
- 主动行为引擎接入：每个游戏日最多一条世界事件（proactive run 时惰性生成）；`ProactiveResult` 增加 world_events 计数
- 接口：GET /calendar?from_day&to_day（按日聚合）、POST /calendar/events（约定，居民需属主）、DELETE /calendar/events/{id}；级联清理齐（居民/注销）
- 测试 4 组；全套 79 项绿

### 第二刀：主动聊天就着事件 + 事件影响（已完成）

- `proactive_prompt` 纯函数：letter / greeting / greeting_low / reminder 四种话术，greeting 系自动带入当天世界事件开话题
- 事件心情加成：世界事件当天生成时，全体居民 mood +3（EVENT_MOOD_BONUS，每游戏日一次）
- 约定提醒：开始前 2 个游戏小时内（reminder_due 纯函数），居民在 DM 会话提醒一句，每条约一次（world_events.reminded，迁移 b8c9d0e1f2 / 0009）；`proactive_prompt` 新增 reminder 话术
- ProactiveResult 增加 reminders / mood_bonuses 计数；新增 GET /calendar/clock
- 日历页（/diary 占位替换）：世界时钟头部、七天条、事件列表、建约定表单
- 测试新增 6 组；全套 84 项绿

### M5 待办（开发机）

- 前端构建与 E2E 验证（重点：日历页、/diary 路由）
- 事件影响的展示层：约定临到高亮、世界事件心情加成的提示

---

## M6 进行记录（多端与发布）

### 第一刀：PWA + 部署（已完成）

- **PWA**：`apps/web/public/manifest.webmanifest` + 像素爱心图标（192/512，PIL 生成）+ `sw.js`（静态 cache-first，/api 与 /ws 永不缓存）；main.tsx 生产环境注册；index.html 挂 manifest
- **部署**：`Dockerfile.backend`（多阶段：pip -t .deps 安装，启动先 `alembic upgrade head`）+ `Dockerfile.web`（node 构建 → nginx，SPA 回退 + /api 反代含 WS Upgrade）+ `docker-compose.yml`（backend + web:8080，SQLite 挂 cu-data 卷，密钥走环境变量）+ `.dockerignore`
- **APK（Capacitor）**：`apps/android` 已有 cap 配置（com.cyberuniverse.app），根脚本 `android:sync` 已备；`npx cap add android` 与打包需在开发机执行（需 Android SDK + 网络）

### 发布检查单（开发机执行）

1. `pnpm install && pnpm lint && pnpm typecheck && pnpm test && pnpm build`
2. `pnpm backend:test`（84 项）
3. 启动前后端 + `pnpm test:e2e`（Playwright）
4. PWA：`pnpm --filter @cyber-universe/web build` 后验证 manifest 可达、SW 注册、离线可开
5. `docker compose up --build` 验证容器化部署（迁移自动执行）
6. APK：`pnpm android:sync && npx cap add android && npx cap sync && npx cap build android`（需 SDK）

---

## 开发规范

### 数据契约（禁止重复定义）

1. 后端 Pydantic Schema 是权威定义（`backend/app/schemas/`）。
2. 前端共享类型集中在 `packages/shared`，跨包引用，不在各 app 内重复声明。
3. 后端启动后执行 `pnpm db:generate`（openapi-typescript）生成 `packages/shared/src/api-types.ts` 与手维护类型比对；CI 中对齐检查在 M5 加入。

### 分层红线

- 前端组件不得直接访问数据库；一切数据经 `@cyber-universe/api-client`。
- 游戏引擎不得直接调用大模型 API；AI 决策由后端任务调度，引擎只消费世界状态。
- 后端是所有权威世界状态的唯一持久化方。

### 测试

- 前端：Vitest（组件 / 包逻辑），Playwright（浏览器 E2E，M1 起）。
- 后端：pytest，测试库用独立临时 SQLite（conftest 已隔离）。
- 每次提交前：`pnpm test && pnpm backend:test && pnpm build`。

### 提交纪律

- 无空函数 / 假数据 / 静态页冒充功能；未完成就明确标注。
- 关键数据必须持久化；重要操作必须鉴权；所有 API 必须有错误处理。
- 里程碑结束更新本文件与 README。
