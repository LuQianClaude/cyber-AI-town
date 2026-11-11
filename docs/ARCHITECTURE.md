# ARCHITECTURE — Cyber Universe 架构设计

## 1. 总体架构

```
┌─────────────────────────────────────────────────────┐
│ apps/web (React)          │ apps/android (Capacitor) │
│  UI 组件树 / 路由 / 状态   │  WebView 壳 + Keystore    │
└───────────┬───────────────────────────┬─────────────┘
            │ @cyber-universe/ui, shared, api-client
┌───────────▼───────────────────────────▼─────────────┐
│ packages/game-engine (Phaser 3)                     │
│  世界渲染 / 移动 / 碰撞 / 摄像机 —— 独立 Game Loop     │
│  只通过 api-client 拉取世界快照，绝不直连 LLM         │
└───────────┬─────────────────────────────────────────┘
            │ HTTP REST + WebSocket (JSON)
┌───────────▼─────────────────────────────────────────┐
│ backend (FastAPI)                                    │
│  API 层 → 服务层 → ORM (SQLAlchemy 2)                │
│  ├─ Auth / User / AIResident                         │
│  ├─ Provider Adapter (OpenAI/Claude/Gemini/Custom)   │
│  ├─ 行为引擎 (规则引擎 + 事件调度 + 任务队列)          │
│  ├─ 世界时钟 (离线生长/恢复)                          │
│  └─ WebSocket 网关 (房间鉴权)                         │
│  SQLite (dev) / PostgreSQL (prod) / Redis (后续)      │
└──────────────────────────────────────────────────────┘
```

## 2. Monorepo 边界

| 模块 | 职责 | 禁止事项 |
| --- | --- | --- |
| apps/web | 页面、路由、React 状态 | 直连数据库；持有模型密钥 |
| packages/game-engine | Phaser 场景、输入、动画 | 调 LLM API；感知 React 生命周期 |
| packages/shared | 类型契约、常量、路由表 | 出现运行时副作用代码 |
| packages/ui | 纯展示组件（受控） | 发请求、持业务状态 |
| packages/api-client | HTTP/WS 封装、错误规范化 | 拼接业务语义 |
| backend | 权威状态、调度、密钥保管 | 向前端泄露密钥明文 |

依赖方向：`ui/shared/api-client` 互相独立 → `web` 聚合；`backend` 独立于 TS 工作区。

## 3. 数据契约

- 单一权威：后端 Pydantic Schema。
- 分发路径：OpenAPI → `openapi-typescript` → `packages/shared/src/api-types.ts`。
- 手工维护的 UI 领域类型只在 `shared`，任何包需要同一类型时从 `shared` import。

## 4. 核心系统设计（M2–M4 施工依据）

### 4.1 Provider Adapter（M2）

```
abstract class BaseLLMProvider:
    chat(messages, params) -> stream | completion

OpenAIProvider ─┐
ClaudeProvider ──┼─> 统一 ProviderAdapter 接口
GeminiProvider ──┤    （超时 / 重试 / 限流在适配器外层中间件）
CustomProvider ──┘    （URL 白名单 + SSRF 校验 + 仅内网拒绝）
```

- 密钥：Fernet 加密入库，解密仅在后端调用瞬间；日志统一脱敏拦截器。
- 每个 AI 居民绑定一份 ModelConfig；不同 AI 可共享配置，身份与记忆绝不共享。

### 4.2 行为引擎（M4）

- **规则优先**：作息表、活动权重、优先级队列决定 AI 的普通行为（行走/睡觉/吃饭/浇水…），不调模型。
- **事件触发 LLM**：对话发起、信件撰写、关系变化摘要等语义决策走任务队列（后续接 Redis），带预算与频率上限。
- **离线恢复**：世界时钟按真实流逝时间推进（植物生长、活动结算），服务重启后从持久化状态恢复现场。
- 模拟属性仅作游戏状态表述，不描述真实生理。

### 4.3 世界时钟

- 后端持有 `WorldClock`：真实时间 × 倍率 = 世界时间。
- 所有生长 / 结算逻辑只依赖世界时间戳差值，用户离线不影响推进。

### 4.4 关系与权限

- 独立 `Relationship` 表：类型（朋友/家人/伴侣/配偶/父母/子女/自定义）、状态、创建者与修改者、授权范围。
- AI 修改他人关系必须持有授权令牌，后端逐条校验。
- 家庭 ≠ 婚姻：家庭是居住与共享单元（日历/相册/房间），关系是人际图谱，二者解耦。

### 4.5 WebSocket 网关

- 连接即鉴权（Token → 用户 → 可订阅房间集合）。
- 房间粒度：家庭、聊天会话、世界频道；订阅与广播均校验成员身份。

## 5. 安全清单（施工时逐条落实）

- [x] PBKDF2 密码哈希（M0）
- [x] CORS 白名单（M0）
- [x] 环境变量隔离密钥（M0）
- [ ] 访问令牌 + 会话管理（M2）
- [ ] Fernet 加密 API Key（M2）
- [ ] SSRF 防护（M2）
- [ ] 输入校验 / SQL 注入防护（SQLAlchemy 参数化天然缓解，M2 全面启用）
- [ ] WebSocket 房间鉴权（M2）
- [ ] 账户与数据删除（M2）
- [ ] CSRF（SameSite + 自定义头校验，M2）
- [ ] 限流（M2）

## 6. 数据库演进计划

| 迁移 | 里程碑 | 表 |
| --- | --- | --- |
| 0001 | M2 | users, model_configs, ai_residents, memories |
| 0002 | M3 | families, family_members, rooms, relationships |
| 0003 | M4 | activities, letters, diaries, events, plants, garden_plots, albums |
| 0004 | M2/M4 | chat_sessions, messages, ws 会话审计 |
