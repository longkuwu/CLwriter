# 项目交接文档 (HANDOFF)

> **用途**: 当切换 AI 助手或团队成员时,新人/新模型读完此文档应能在 30 分钟内完整接手项目。
> **更新策略**: 每完成一个里程碑后更新对应章节,保持文档与代码同步。

---

## 0. 快速上手 (5 分钟读完)

### 这是什么项目?

CLwriter — AI 多 Agent 协作小说创作平台,专为长篇小说写作优化。

**仓库**: https://github.com/longkuwu/CLwriter
**当前版本**: v3.0 重构进行中 (从 v2.0 状态驱动模式升级到多 Agent 架构)
**项目根目录**: `D:\xiaoshuo\ip-architect`

### 这是一次什么样的重构?

把原来的"单 Agent 全能模式"重构为"多 Agent 协作流水线",核心解决三大痛点:
1. AI 痕迹明显 → 引入 Humanizer Agent
2. 长篇记忆混乱 → 引入分层记忆 + Anchor + Timekeeper
3. 单 Agent 样样不精 → 7 个专业 Agent 各司其职

### 现在做到哪一步了?

✅ **已完成**:
- v2.0 状态驱动引擎 (15 维快照 + CHANGES + 6 道门禁) — 完整可用
- 协议蓝图系统 (支持 OpenAI/NewAPI/Anthropic/Gemini/Ollama 等 12 种协议) — 完整可用
- 模型扫描器 + 端点自动发现 (借鉴天命算法) — 完整可用
- 重构方案设计文档 — 完整可用 (本目录)

🚧 **进行中**:
- Spec 三件套已写完: requirements.md, design.md, tasks.md
- 等待开始实施阶段 1 (MVP)

⛔ **未开始**:
- 任何 v3.0 的代码实现 (tasks.md 中所有任务都未开始)

### 我接下来该做什么?

**最直接的指令: 打开 [tasks.md](./tasks.md),从任务 1 开始往下做。**

每完成一个任务,把对应的 `[ ]` 改成 `[x]`,并 commit。

---

## 1. 完整背景

### 1.1 用户

- **用户名**: longkuwu (GitHub)
- **使用场景**: 写网络小说,关心 AI 检测率和长篇记忆问题
- **配置的 LLM**: 用户用 `https://new.sharedchat.cc/codex` 中转服务 (OpenAI Codex 风格 API),也用过 `https://marybrown.dpdns.org/v1` (标准 OpenAI 兼容)
- **技术水平**: 不写代码,但能看懂技术方案,会主动提出架构建议

### 1.2 决策记录

用户在 spec 起草过程中明确做了 5 个核心决策:

| 决策 | 选项 | 用户选择 |
|------|------|---------|
| Q1 spec 范围 | A=MVP / B=阶段1+2 / C=全期 | **B** (后扩展为全期 spec,18 条 Requirement) |
| Q2 Agent 通信 | A=函数调用 / B=消息总线+持久化 | **B** |
| Q3 章节生成 UX | A=全流式 / B=全批量 / C=混合 | **C** (Writer 流式,后台静默) |
| Q4 干预模式 | A=一键 / B=干预 / C=专家 | **三种都加,用户自由切换** |
| Q5 砍除清单 | 列表确认 | **按列表砍** |

用户后续又提出 3 个争议点 (写在 requirements.md §1.5 关键决策):

| 决策 | 用户选择 |
|------|---------|
| D1 Memory/Anchor 在主流水线位置 | 横切关注点 (不占独立时间槽) |
| D2 时间预算 | 分阶段预算 + 总上限 600s + 重写次数限制 |
| D3 角色三级模型 | L1/L2/L3 差异化 Anchor |

### 1.3 没决定的事

- 阶段 2/3 的具体 UI 细节 (留给后续 spec)
- ONNX 本地模型的具体选择 (Cherry Studio 用的 bge-small-zh-v1.5 是天命的方案,可参考)
- 多模型融合的具体策略

---

## 2. 项目结构现状

### 2.1 文件树

```
D:\xiaoshuo\ip-architect/
├── .kiro/
│   └── specs/
│       └── multi-agent-novel-system/   # 🎯 你最该看的文档
│           ├── requirements.md         # 18 条需求 + 关键决策 + 错误码
│           ├── design.md               # 详细技术设计 (重点是阶段 1)
│           ├── tasks.md                # 58 个任务,按阶段排序
│           └── HANDOFF.md              # 本文档
├── docs/
│   └── ARCHITECTURE.md                 # v2.0 状态驱动架构 (历史文档,部分仍有效)
├── src/
│   ├── app/                            # Next.js App Router
│   │   ├── editor/[projectId]/         # 编辑器主页
│   │   ├── api/proxy/                  # CORS 代理 (浏览器开发用)
│   │   └── page.tsx                    # 项目列表
│   ├── components/
│   │   ├── editor/                     # ⚠️ 旧版组件,Task 2 要归档大部分
│   │   ├── engine/                     # ✅ v2.0 引擎面板,保留
│   │   ├── settings/                   # ✅ 协议蓝图设置,保留
│   │   ├── sidebar/                    # ⚠️ 部分要归档
│   │   ├── modals/                     # 风格胶囊弹窗
│   │   └── ui/                         # shadcn 基础组件
│   ├── lib/
│   │   ├── ai/
│   │   │   ├── protocol/               # ✅ 协议蓝图 (完整可用)
│   │   │   │   ├── types.ts            # ProtocolBlueprint 定义
│   │   │   │   ├── presets.ts          # 12 个内置协议
│   │   │   │   ├── client.ts           # chatCompletion + listModels
│   │   │   │   ├── executor.ts         # URL/auth/body 解析
│   │   │   │   ├── storage.ts          # localStorage 管理
│   │   │   │   ├── endpoint-discovery.ts  # 候选 URL 生成 (天命算法)
│   │   │   │   └── test-connection.ts  # 极简对话测试
│   │   │   ├── *-agent.ts              # ⚠️ 旧版 Agent (重构后会被替换或归档)
│   │   │   └── ...
│   │   ├── engine/                     # ✅ v2.0 状态驱动引擎 (保留并复用)
│   │   │   ├── changes/                # CHANGES 协议
│   │   │   ├── snapshot/               # 15 维快照
│   │   │   ├── gates/                  # 6 道门禁
│   │   │   ├── pack/                   # 数据中心打包
│   │   │   └── prompts/                # 章节生成 prompt
│   │   ├── db/
│   │   │   ├── schema.ts               # 🔄 Task 1 要扩展
│   │   │   └── index.ts                # PGlite 单例
│   │   ├── actions/                    # 数据操作
│   │   ├── tauri-api.ts                # Tauri/Web 兼容的 LLM 调用
│   │   └── novel-state.tsx             # 旧版状态 (会被替换)
│   └── ...
├── src-tauri/                          # Tauri Rust 后端
├── public/                             # 静态资源
├── package.json
├── next.config.mjs
└── ...
```

### 2.2 数据库现状 (PGlite)

存储位置: 浏览器 IndexedDB / Tauri 文件

**当前已有表:**
- `projects` — 项目
- `files` — 章节/设定文件 (统一文件表)
- `embeddings` — 向量
- `userStyles` — 风格胶囊
- `codex` — 旧版记忆库 (已废弃但表还在)
- `characters` `worldSettings` `chapters` — 旧版表 (已废弃)
- `summaries` — 章节摘要
- `factSnapshots` — 15 维快照 (v2.0)
- `chapterChanges` — CHANGES 记录 (v2.0)
- `entities` — 实体档案 (v2.0)
- `gateLogs` — 门禁日志 (v2.0)
- `milestones` — 历史里程碑 (v2.0)

**v3.0 要新增:**
- `agentTasks`
- `agentMessages`
- `promptOverrides`
- `entities` 扩展字段: `level`, `appearanceCount`, `anchor`, `lastAppearedChapter`, `levelManuallyLocked`

详见 design.md §2.6。

---

## 3. 技术栈

```
前端: Next.js 14 (App Router) + TypeScript + Tailwind + shadcn
桌面: Tauri 2 (Rust 后端只做 HTTP 代理)
数据库: PGlite (浏览器内嵌 PostgreSQL) + Drizzle ORM
编辑器: Tiptap 3
状态管理: Zustand
LLM: 协议蓝图系统 (支持任意 OpenAI/Anthropic/Gemini/Ollama 兼容协议)
```

**重要约束:**
- 完全客户端,**没有任何后端服务器** (除了 /api/proxy 这个 CORS 代理 route)
- 所有数据存在用户本地 (localStorage / PGlite IndexedDB)
- API Key 不上传任何服务器

---

## 4. 工作流和命令

### 4.1 启动开发

```bash
# Web 开发模式 (推荐)
cd D:\xiaoshuo\ip-architect
./node_modules/.bin/next.cmd dev
# 访问 http://localhost:3000

# 或者用 npm run dev (如果用户的 PATH 配置好了)
npm run dev

# 桌面开发模式 (Tauri)
npm run dev:desktop
```

**已知问题:** Windows 上 `npm run dev` 可能找不到 `next` 命令,直接用 `./node_modules/.bin/next.cmd dev` 即可。

### 4.2 Build

```bash
./node_modules/.bin/next.cmd build
```

注意 `next.config.mjs` 配置了 `ignoreBuildErrors: true` 和 `ignoreDuringBuilds: true`,这是为了让 v2.0 历史代码先 build 通过。**新代码 (v3.0) 写完后应该把这两个开关关掉,严格 type check**。

### 4.3 数据库 migration

```bash
# 修改 src/lib/db/schema.ts 后
npx drizzle-kit generate
# 生成的 SQL 在 drizzle/migrations/
# 运行 migration 由 PGlite 在应用启动时自动完成 (见 src/lib/db/index.ts)
```

### 4.4 Git 工作流

```bash
git status
git add .
git commit -m "feat(agents): implement Writer Agent"
git push
```

**Commit message 风格:** `feat(模块): 描述` 或 `fix(模块): 描述`,模块名用英文。

---

## 5. 关键代码点位

### 5.1 你最常需要看的文件

| 想做什么 | 看哪里 |
|---------|-------|
| 理解需求 | `requirements.md` (18 条 Requirement + §1.5 关键决策) |
| 理解技术方案 | `design.md` (重点 §2 阶段 1) |
| 找下一个任务 | `tasks.md` (从上往下做) |
| 看 v2.0 引擎怎么用 | `src/lib/engine/index.ts` (看导出的接口) |
| 看 LLM 怎么调 | `src/lib/ai/protocol/client.ts` (chatCompletion + streamChatCompletion) |
| 看现有数据库 | `src/lib/db/schema.ts` |
| 看现有 UI 主页 | `src/app/editor/[projectId]/page.tsx` |

### 5.2 千万别动的代码

- `src/lib/engine/*` — v2.0 状态引擎,所有 v3 Agent 都依赖,不要改实现 (可以扩展)
- `src/lib/ai/protocol/*` — 协议蓝图系统,千万别动 (用户花了好几轮才调好的)
- `src/lib/db/schema.ts` 现有表 — 只增不删,删表会破坏老用户数据

### 5.3 可以放心改/删的代码

- `src/components/editor/ChapterLauncher.tsx` — Task 2 直接归档
- `src/components/editor/EngineSwitch.tsx` — 归档
- `src/components/editor/ViralFlow.tsx` — 归档
- `src/components/sidebar/scenario-preview.tsx` — 归档
- `src/components/sidebar/ViralSidebar.tsx` — 归档
- `src/components/sidebar/WorldStatePanel.tsx` — 归档
- `src/lib/ai/*-agent.ts` 旧版 Agent — Task 完成后会被新 Agent 替换

---

## 6. 用户协作风格

### 6.1 用户的偏好

- 偏好简洁直接的回答,不喜欢长篇大论
- 喜欢看到具体的代码 / 命令 / 文件路径
- 会主动提出架构改进建议,需要认真考虑
- 关注实际可用性,不喜欢"看着花哨但跑不通"的方案
- 用户的中转 API 经常要测,有问题会发"扫描不到"这种简短消息

### 6.2 用户最讨厌的事

1. **AI 自己看不到错误还要用户复述** — 我们能看 dev server 日志,主动看
2. **方案里给一堆选项让用户选** — 给推荐方案 + 一句话理由,用户不想做选择题
3. **修了一遍又坏一遍** — 改完代码必须 build 通过 + 跑一遍冒烟测试

### 6.3 用户的常用沟通方式

- 用户经常用很短的句子 (如"还能工作吗?", "扫描不到模型")
- 看到有问题会直接说"不行/不对",需要主动诊断而不是问"具体是什么问题?"
- 用户**强烈期望 AI 主动看日志、主动诊断、主动定位问题**

---

## 7. 各项目历史里程碑

| 日期 | 里程碑 |
|------|-------|
| 2026-04 | v1.0 双引擎模式 (Epic + Viral) — 基础项目 |
| 2026-05 早 | v2.0 状态驱动引擎 (借鉴天命) — 15 维快照 + CHANGES + 6 道门禁 |
| 2026-05 中 | UI 引擎面板 (FactSnapshotPanel + GateLogPanel + EntityManagerPanel) |
| 2026-05 中 | 协议蓝图系统 — 支持任意 LLM 协议 + 模型扫描 + 测试连接 |
| 2026-05 中 | NewAPI Codex 协议支持 — 解决 sharedchat.cc/codex 端点 |
| 2026-05 中 | **当前节点: 完整 spec 三件套就绪,等待启动 v3.0 实施** |

---

## 8. 已知问题与陷阱

### 8.1 Build 警告

`next.config.mjs` 临时关闭了 type check 和 ESLint,因为 v2.0 历史代码有大量 strict mode 不达标。**v3.0 新代码必须严格 type check**,实施完阶段 1 后建议把开关打开,逐步修历史代码。

### 8.2 PGlite 不支持显式事务

`BEGIN/COMMIT/ROLLBACK` 在 PGlite 不可用。Continuity Agent 的"原子事务"实际上是顺序操作 + 失败回滚 (反向删除已写部分)。详见 design.md ADR-003。

### 8.3 流式输出与干预模式冲突

如果用户在 Writer 流式输出过程中切到干预模式,**不能中途暂停**,会丢失内容。Req 7.4 明确流式过程中不暂停,流式结束后才暂停。实施时注意这个边界。

### 8.4 模型扫描的 16 字节响应

某些中转服务的 `/v1/models` 返回 `{"success":true}` (16 字节) 不带 data 数组。当前协议蓝图系统会把这种识别为"扫描失败但端点存在",提示用户手动填模型 ID。详见 `src/lib/ai/protocol/endpoint-discovery.ts`。

### 8.5 Auto-Pilot 累计 Token 超 500K 强制暂停

Req 14.7 / 17.6 要求,实施时千万别忘,否则用户可能被炸账单。

### 8.6 Codex 风格 API 用 /responses 不是 /chat/completions

如果用户配的是 `https://xxx/codex` 这种,需要选 "NewAPI Codex 中转 (Codex 风格)" 协议蓝图,使用 `/responses` 端点。详见 `src/lib/ai/protocol/presets.ts`。

---

## 9. 推荐的接手第一天

如果你是新接手的 AI 助手或开发者,推荐按这个顺序:

1. **第 1 步**: 读完本 HANDOFF.md (你在做的事)
2. **第 2 步**: 读 `requirements.md` 的 §1 Introduction + §1.5 关键决策 (15 分钟)
3. **第 3 步**: 读 `design.md` 的 §2 阶段 1 详细设计 (30 分钟)
4. **第 4 步**: 浏览一遍 `tasks.md` 全部 58 个任务,有大致印象
5. **第 5 步**: 启动 dev server,体验一次现有产品 (理解 v2.0 是什么样)
   ```bash
   ./node_modules/.bin/next.cmd dev
   # 浏览器打开 http://localhost:3000
   # 创建一个项目,试一下右侧栏的"状态引擎"面板
   ```
6. **第 6 步**: 找到 `tasks.md` 的任务 1,开始动手
7. **第 7 步**: 完成第一个任务后, commit + push,告诉用户进度

---

## 10. 联系点和资源

### 10.1 用户期望的 AI 行为

- 主动诊断 (看 dev 日志, build, 实际运行)
- 不要让用户做太多选择题,给推荐方案
- 完成任务后主动 commit + push
- 遇到问题先尝试解决,而不是问用户

### 10.2 重要的外部参考

- **天命项目** (zy-zmc/tianming-novel-ai-writer) — v2.0 引擎设计灵感来源,值得参考
- **Cherry Studio** — UI 设计参考 (我们的协议蓝图模仿了它的多协议支持)
- **CrewAI / LangGraph** — 多 Agent 架构参考

### 10.3 协议蓝图系统的支持范围

支持任何符合以下格式之一的 LLM API:
- OpenAI 兼容 (OpenAI / DeepSeek / Moonshot / Groq / NewAPI / 智谱 / Mistral / Cohere)
- Anthropic 原生 (Claude)
- Google Gemini
- Ollama 本地
- OpenAI Responses API (Codex 风格中转)
- 用户可自定义协议蓝图 (JSON 编辑或可视化表单)

---

## 11. 文档维护责任

每完成一项重大里程碑,务必更新本文档:

- 完成阶段 1: 更新 §0.4 "现在做到哪一步了"
- 完成阶段 2/3: 同上
- 修改 spec: 同步更新本文档相关引用
- 发现新陷阱: 加到 §8 "已知问题与陷阱"

**最后更新**: 2026-05 (v3.0 spec 三件套完成,等待实施)
