# Requirements Document

CLwriter v3.0 — 多 Agent 协作小说创作系统

## Introduction

### 背景

CLwriter 当前版本 (v2.0) 已实现"状态驱动写作"引擎,包括 15 维事实快照、CHANGES 协议、6 道生成门禁等核心能力,但实际使用中暴露出三个核心问题:

1. **单 Agent 模式局限** — 一个 LLM 调用同时承担规划、写作、审稿、状态管理等多种角色,样样都做但都做不精
2. **AI 痕迹明显** — 生成的文本机器味重,容易被 AIGC 检测识别,平台风控会限流
3. **长篇记忆混乱** — 写到几十章后,设定漂移、伏笔忘收、时间线错乱

### 目标

将系统重构为多 Agent 协作架构,通过专业化分工 + 编排协同,实现:

- **质量提升**: 每个 Agent 专注一项职责,产出质量优于全能 Agent
- **AI 率可控**: 引入 Humanizer Agent + 本地检测,生成内容 AI 率 ≤ 30%
- **长篇连贯**: 引入 Memory + Anchor + Timekeeper 三 Agent,百章不漂移
- **可控可见**: 用户能看到每个 Agent 在做什么、产出了什么、消耗了多少 token
- **灵活干预**: 三种交互模式 (一键/干预/专家) 适配不同用户
- **可扩展**: 三阶段渐进推进,每阶段都能产出可用产品

### 范围

本 spec 覆盖完整产品的需求,分三阶段实施:

| 阶段 | 包含 Agent | 估算工期 |
|------|-----------|---------|
| **阶段 1 (MVP)** | Director / Writer / Critic / Continuity | 1-2 周 |
| **阶段 2** | + Memory / Humanizer / Anchor | 3-4 周 |
| **阶段 3** | + WorldBuilder / Character / Outliner / ChapterPlanner / Timekeeper | 5-6 周 |

### 保留与砍除

**保留并增强 (复用 v2.0 引擎):**
- 15 维事实快照系统 → Memory L3 层 + Continuity 投影源
- CHANGES 协议 → Writer 输出契约
- 6 道生成门禁 → Continuity Agent 主体
- 协议蓝图系统 → 所有 Agent 调用 LLM 的统一适配
- Tiptap 编辑器 → 章节查看/编辑
- PGlite 本地存储 → 持久化层

**砍除:**
- 双引擎模式 (Epic/Viral) → 统一引擎 + 风格胶囊代替
- 流量爆款打脸卡片 → 改造为 Critic 的爽点检测维度
- 旧 ChapterLauncher → 由 Director 工作台替代
- HP/位置/物品 RPG UI → 合并到事实快照面板
- EngineSwitch → 不再需要
- 硬编码的 AI 逻辑检查 → Critic Agent 接管
- ScenarioPreview → Director 实时显示替代
- 旧版 WorldStatePanel → FactSnapshotPanel 替代

### 关键决策

#### D1: 主流水线 vs 横切关注点

**主流水线序列 (阶段 3 完整版,有顺序依赖):**
```
ChapterPlanner → Writer → Humanizer → Critic → Timekeeper → Continuity
```

**事件流 (按上述顺序):**
```
PLAN_READY → DRAFT_READY → HUMANIZED_READY → CRITIQUED_READY → TIME_VERIFIED → CHAPTER_FINALIZED
```

**横切支持 Agent (不占独立时间槽,与所属 Agent 共享耗时):**
- **Memory Agent**: 在每个核心 Agent 启动前注入相关上下文 (像中间件)
- **Anchor Agent**: 在 Writer 输入前注入角色性格指纹,在 Writer 输出后追加 anti-trait 校验

**阶段 1 (MVP) 简化序列:**
```
Writer → Critic → Continuity
事件: DRAFT_READY → CRITIQUED_READY → CHAPTER_FINALIZED
```

#### D2: 时间预算 (针对单章 3000 字生成)

**首次顺利通过路径 (无重写):** ≤ 90 秒
- Memory 5s, ChapterPlanner 15s, Writer 60s (流式), Humanizer 单轮 5s, Critic 5s, Timekeeper 1s, Continuity 2s

**含 1 轮重写路径:** ≤ 200 秒
**绝对上限:** 600 秒 (超过强制提前结束 + 标记 `pending_review`)

**重写次数限制 (各 Agent 自治):**
| Agent | 局部重写 | 整章打回 |
|-------|---------|---------|
| Writer 内部 (CHANGES 校验失败) | - | 自重试最多 3 次 |
| Humanizer (AI 率超标) | 5 轮 | - |
| Anchor 局部 (vocab 未命中) | 2 轮 | - |
| Anchor 强制 (anti_trait 违反) | - | 3 轮,然后 pending_review |
| Critic 局部建议 | 2 轮 | - |
| Critic 整章打回 | - | 3 次,然后 pending_review |
| Continuity 门禁失败 | - | 3 次,然后 pending_review |

任意 Agent 触发重写时,系统须在 UI 上展示原因和当前重写次数。

**重写计数持久化 (修订自 REVIEW-2026-05 #6):**
- `agent_tasks.attempt` 字段记录当前 Agent 的尝试次数
- 任务恢复时基于 `attempt` 决定是否还能重试,避免恢复后重置计数

#### D3: 角色三级模型

| 等级 | 判定标准 | Anchor 内容 | 校验强度 |
|------|---------|------------|---------|
| **L1 主角/主要配角** | 累计出场 ≥ 5 章 或 用户标记 `pivot` | 完整 Anchor: 5-10 条 vocabulary_signature + sentence_style + thinking_pattern + 3-5 条 core_traits + 3-5 条 anti_traits | 每章必须命中 ≥1 条 vocab,违反 anti_trait 强制重写 |
| **L2 次要角色** | 累计出场 2-4 章 或 用户标记 `recurring` | 简化 Anchor: 2-3 条 core_traits + 2-3 条 anti_traits (不要求 vocab) | 仅校验 anti_traits,违反提示警告(可放行) |
| **L3 龙套** | 累计出场 1 章 或 命名匿名 (如 "路人甲") | 不生成 Anchor | 不参与任何 Anchor 校验 |

**自动晋级规则:**
- L3→L2 阈值: appearanceCount ≥ 2
- L2→L1 阈值: appearanceCount ≥ 5
- 升级时**仅更新 `entities.level` 字段,不自动生成 Anchor 内容**
- 升级后 Director 主动通知用户:"角色 X 已成长为 LX,建议补充档案",用户可选立即生成或稍后

**降级:** 仅手动归档触发,不自动降级。

#### D4: 创世流水线 (项目初始化)

**项目初始化不走 Auto-Pilot,使用独立的"创世流水线":**
```
WorldBuilder → Character → Outliner
```
每步完成后**强制暂停**等待用户审核,即使是一键模式。

#### D5: 章节生成最低前置条件 (修订自 REVIEW-2026-05 #8)

**章节生成的前置条件按"能力级别"分两类,不混用:**

**基础生成前置 (硬门槛,不满足拒绝生成):**
- ≥1 个主角实体 (`entities.type='character'`,等级不强求)
- ≥1 条世界观硬约束规则
- 已配置可用 LLM (经 testConnection 通过)

**Anchor 严格校验前置 (软条件,不满足时退化):**
- 当某 L1 角色 `anchorStatus='complete'` 时,启用该角色的严格 Anchor 校验
- 当 `anchorStatus !== 'complete'` 时,Anchor Agent 对该角色按 L3 处理 (跳过)
- **Anchor 不是基础门槛**,缺失只降低一致性保证,不阻塞章节生成

**理由:** Anchor 是阶段 2 才存在的 Agent。在阶段 1 不能要求项目有"完整 Anchor"才能生成章节,否则 MVP 无法实施。

#### D6: 角色等级与 Anchor 完整度正交 (修订自 REVIEW-2026-05 #9)

**等级 (level) 和档案完整度 (anchorStatus) 是两个独立维度,不能混用。**

**新增字段:**
- `entities.anchorStatus`: `'missing' | 'partial' | 'complete'`
  - `missing`: 完全没填
  - `partial`: 有 core_traits 但没 vocabulary_signature (适用于 L2)
  - `complete`: 全部字段填齐 (适用于 L1)
- `entities.anchorStrictEnabled`: boolean,用户可手动关闭某个角色的严格校验

**Anchor 校验决策表:**

| level | anchorStatus | strictEnabled | Anchor 行为 |
|-------|-------------|---------------|------------|
| L1 | complete | true | 完整校验 (vocab + anti_traits) |
| L1 | complete | false | 仅 anti_traits 校验 |
| L1 | partial | * | 退化为 L2 行为 |
| L1 | missing | * | 退化为 L3 行为 (跳过) |
| L2 | complete/partial | * | 仅 anti_traits 校验 |
| L2 | missing | * | 退化为 L3 行为 (跳过) |
| L3 | * | * | 不参与 Anchor 校验 |

**自动晋级时,只更新 `level`,不更新 `anchorStatus`**,因此升级后的角色按 D6 表自动退化到合理行为,不会出现"L1 但 Anchor 校验失败"的诡异状态。

#### D7: 长任务运行时差异 (修订自 REVIEW-2026-05 #14)

**新增运行时模式概念:**
- `RuntimeMode = 'browser' | 'tauri'`
- `browser` 模式: 浏览器环境,标签页可能被 throttle
- `tauri` 模式: 桌面应用,生命周期更稳定

**模式差异化能力 (MVP):**
- `browser`: Auto-Pilot 单次最多 5 章,标签页隐藏 5 分钟自动暂停
- `tauri`: Auto-Pilot 单次最多按 Req 14.7 (1 小时或 500K token)

**注意:** 这是"能力差异",不是"架构差异"。所有 Agent 仍跑在客户端,只是 Auto-Pilot 上限不同。Tauri sidecar / Rust command 不在 v3.0 范围。

## Glossary

| 术语 | 定义 |
|------|------|
| **Agent** | 一个专注于单一职责的 LLM 调用单元,有明确输入/输出契约 |
| **CHANGES 协议** | Writer 在正文末尾输出的 12 类结构化状态变更声明 (v2.0 引擎遗留),用 `---CHANGES---` 分隔 |
| **15 维事实快照** | 累积式状态存档,包含角色/位置/伏笔/誓约等 15 个维度,每章累加更新 |
| **6 道生成门禁** | 章节落地前必须通过的 6 项校验: 协议解析/引用/一致性/未知实体/描写一致性/蓝图出场 |
| **协议蓝图** | 描述某 LLM API 协议格式的 JSON 配置,实现 OpenAI/Anthropic/Gemini 等多协议适配 |
| **流水线 (Pipeline)** | 多个 Agent 按固定顺序执行的链路 |
| **横切关注点 (Cross-cutting concern)** | 不在主流水线时间轴中独占时间槽的 Agent (如 Memory/Anchor) |
| **数据包 (Pack)** | Memory Agent 为下游 Agent 准备的上下文集合 (含 L1-L6 多层) |
| **Anchor (锚点/指纹)** | 角色的"性格 DNA",包含口头禅/句式偏好/不可违反的反向特征等 |
| **L1/L2/L3 角色** | 三级角色模型 (D3 决策),决定 Anchor 完整度 |
| **anchorStatus** | 角色档案完整度: missing/partial/complete (D6 决策) |
| **anchorStrictEnabled** | 用户可手动关闭某角色的严格 Anchor 校验 (D6 决策) |
| **创世流水线** | 项目初始化时的 WorldBuilder→Character→Outliner 链路 (D4 决策) |
| **主流水线** | 章节生成时的 ChapterPlanner→...→Continuity 链路 (D1 决策) |
| **一键/干预/专家模式** | 三种用户干预级别 (Q4 决策) |
| **Auto-Pilot** | 连续生成 N 章的全自动模式 |
| **Co-Pilot** | 用户每次手动触发单章生成的半自动模式 |
| **pending_review** | 章节状态: 自动流水线无法完成,需要用户人工处理 |
| **生命周期事件** | Agent 函数执行的运行时事件 (`AGENT_STARTED/FINISHED/FAILED`),不携带业务语义 (Review #3) |
| **业务语义事件** | 流水线推进的业务里程碑事件 (`PLAN_READY` `DRAFT_READY` `CHAPTER_FINALIZED` 等) |
| **commit journal** | 章节落地的两阶段提交日志 (`chapterCommits` 表),实现"假事务"的可恢复性 (Review #1) |
| **RuntimeMode** | `browser` 或 `tauri`,影响 Auto-Pilot 上限和恢复策略 (D7 决策) |
| **TokenBudget** | 跨 Agent 的统一 token 预算服务,防止数据包超 LLM context (Review #12) |
| **RewriteRequest** | Critic 请求 Writer 重写时的结构化请求,含 mode/targetRanges/preserveChanges (Review #10) |
| **budgetSession** | Auto-Pilot 跨章累计 token 的会话表 (Review #18) |

## Requirements

### Requirement 1: Agent 任务编排与流水线

**User Story:** 作为小说作者,我希望系统能把"生成下一章"这种复杂任务自动拆解为多个 Agent 子任务并按序执行,这样我不需要手动操作每一步。

#### Acceptance Criteria

1. WHEN 用户通过任意方式触发"生成下一章" (Director 对话框、专用按钮、键盘快捷键) THEN Director Agent SHALL 创建一个父任务,并按主流水线序列 (D1 决策) 创建子任务
2. WHEN Director 创建父任务后 THEN Director SHALL 立即创建一个 `draft` 状态的章节文件作为占位,UI 可立即显示
3. WHEN 阶段 1 (MVP) 实施时 THEN 流水线 SHALL 简化为 Writer → Critic → Continuity (Humanizer/Timekeeper/ChapterPlanner 留空跳过)
4. WHEN 父任务被创建 THEN 系统 SHALL 在 `agent_tasks` 表中持久化任务及其状态 (pending/running/done/failed/cancelled)
5. WHEN 一个子任务完成 THEN 系统 SHALL 自动触发下一个子任务 (一键模式),或暂停等待确认 (干预模式)
6. WHEN 任意 Agent 失败 THEN 该 Agent SHALL 发布 `<AGENT>_FAILED` 事件 (含错误信息),由 Director 决定: 自动重试 / 调用其他 Agent 修复 / 上报用户
7. IF 用户在任务进行中关闭页面 THEN 系统 SHALL 保存当前任务进度,下次打开时显示"恢复任务"提示
8. WHEN 父任务全部子任务完成 THEN 系统 SHALL 在一个数据库事务中原子性地写入: 章节文件 (draft → final)、CHANGES 记录、新事实快照、timeline 条目
9. WHEN 多个独立 Agent 可以并行 (阶段 3 中 Critic 与 Timekeeper 互不依赖时) THEN 系统 SHALL 并行执行以缩短总耗时
10. WHEN 章节被标记为 `pending_review` THEN UI SHALL 显示提示,用户可选: "接受当前内容并落地"、"删除草稿重新生成"、"手动编辑后落地"

### Requirement 2: Agent 间消息总线

**User Story:** 作为系统架构师,我希望 Agent 之间通过消息总线通信而不是直接函数调用,这样可以中断、回放、监控任务,UI 也能实时显示进度。

#### Acceptance Criteria

1. WHEN Agent A 完成工作 THEN Agent A SHALL 通过消息总线发布**语义级事件** (如 `DRAFT_READY`)
2. WHEN 一个事件被发布 THEN 订阅该事件的 Agent SHALL 收到通知并触发对应处理
3. WHEN 一个**语义级事件**被发布 THEN 系统 SHALL 把事件持久化到 `agent_messages` 表
4. WHEN 流式 chunk 被产生 (如 Writer 流式输出文本) THEN 系统 SHALL 仅 in-memory 转发不持久化每个 chunk,避免 DB 膨胀
5. WHEN UI 订阅任务流 THEN UI SHALL 通过 React hook (如 `useTaskStream`) 订阅总线,实时显示 Agent 输入/输出/耗时/Token
6. IF 用户点击"取消" THEN 系统 SHALL 设置任务为 `cancelled` 状态,正在运行的 Agent 在下一个检查点退出 (流式中可立即中断,非流式等待当前 LLM 调用完成)
7. WHEN 任务被恢复 THEN 系统 SHALL 从最后一个未完成的子任务继续,而不是从头来过
8. WHEN 总线持久化消息超过 10000 条 THEN 系统 SHALL 归档老消息到压缩 JSON 文件,DB 仅保留最近 1000 条

**标准事件清单 (修订自 REVIEW-2026-05 #3):**

事件分两类,**不可混用**:

**生命周期事件 (运行时,UI 用):**
| 事件名 | 含义 |
|--------|------|
| `AGENT_STARTED` | Agent 开始执行 (payload 含 agentName) |
| `AGENT_FINISHED` | Agent 函数返回 (无论成败,带 success: boolean) |
| `AGENT_FAILED` | Agent 抛异常 (带错误码) |
| `AGENT_PROGRESS` | Agent 内部进度报告 (如 Humanizer 第 N 轮) |
| `STREAM_CHUNK` | 流式输出片段 (in-memory 不持久化) |
| `STREAM_DRAFT_SNAPSHOT` | 节流式草稿快照 (持久化, Review #7) |

**业务语义事件 (流水线,Agent 用):**
| 事件名 | 发布者 | 含义 |
|--------|--------|------|
| `PLAN_READY` | ChapterPlanner | 章节蓝图已就绪 |
| `DRAFT_READY` | Writer | 草稿+CHANGES 已生成 |
| `HUMANIZED_READY` | Humanizer | AI 率已优化 |
| `CRITIQUED_READY` | Critic | 审稿通过 |
| `TIME_VERIFIED` | Timekeeper | 时间线校验通过 |
| `CHAPTER_FINALIZED` | **唯一: Continuity** | 章节最终落地 (Review #2) |
| `RETRY_REQUESTED` | Director | 请求某 Agent 重试 |
| `REWRITE_REQUESTED` | Critic/Anchor | 请求 Writer 局部或整章重写 (含 RewriteRequest) |
| `USER_DECISION` | UI | 用户在干预模式下的决策 |
| `PIPELINE_PAUSED` | Orchestrator | 流水线暂停等待 |
| `PIPELINE_COMPLETED` | Orchestrator | 编排完成 (运行时事件,非业务事件) |
| `LEVEL_UP_NOTICE` | Continuity | 角色等级跨阈值升级提示 |

**业务判断必须用业务语义事件,不能用 `AGENT_FINISHED` 推断业务结果。**

### Requirement 3: Director Agent (总导演)

**User Story:** 作为用户,我希望和一个能听懂我意图的"导演"对话,而不是面对一堆按钮和参数,这样创作更顺畅。

#### Acceptance Criteria

1. WHEN 用户在 Director 工作台对话框输入自然语言指令 (如"写下一章") THEN Director SHALL 解析意图并生成执行计划
2. WHEN Director 生成执行计划 THEN Director SHALL 在 UI 上展示步骤清单 (如 "①调用 ChapterPlanner ②调用 Writer..."),用户可确认或修改 (一键模式自动确认)
3. WHEN 用户确认计划 THEN Director SHALL 派发任务到对应 Agent
4. IF 用户的指令与现有设定冲突 (如"让已死的角色复活") THEN Director SHALL 在执行前给出警告并询问处理方式
5. IF 项目不满足 D5 章节生成最低前置条件 THEN Director SHALL 引导用户补充设定而非直接生成
6. WHEN 任务执行完成 THEN Director SHALL 用自然语言总结结果 (如 "已生成第 12 章 2347 字,触发 3 个伏笔,AI 率 22%")
7. WHEN 用户提出含糊指令 (如"再来一段") THEN Director SHALL 基于上下文猜测意图,不确定时主动询问
8. WHEN Director 检测到用户跨多次对话讨论同一主题 THEN Director SHALL 维护对话上下文,避免重复询问
9. WHEN 任意 Agent 发布 `<AGENT>_FAILED` 事件 THEN Director SHALL 是唯一的失败处理决策者 (各 Agent 不直接互相重试)
10. WHEN Continuity 标记章节为 `pending_review` THEN Director SHALL 在工作台向用户呈现该状态及处理选项 (Req 1.10)

### Requirement 4: Writer Agent (执笔作家)

**User Story:** 作为读者,我希望生成的章节正文是流式输出的,看着字蹦出来很有沉浸感,而不是等半分钟突然弹出一大段。

#### Acceptance Criteria

1. WHEN Writer 收到章节蓝图 + 上下文数据包 THEN Writer SHALL 调用 LLM 流式接口生成正文
2. WHEN LLM 流式输出 chunk THEN Writer SHALL 立即把 chunk in-memory 转发到总线 (`STREAM_CHUNK` 事件,不持久化),UI 实时追加显示
3. WHEN Writer 流式累计达到 500 字 **OR** 距上次快照超过 2 秒 THEN Writer SHALL 把当前累计文本作为 `tempDraft` 写入 `agent_tasks.output.tempDraft` 字段 (Review #7)
4. WHEN Writer 完成正文 THEN Writer SHALL 在末尾追加 `---CHANGES---` 协议段
5. IF Writer 输出的 CHANGES 段不合法 THEN Writer **自身** SHALL 自动重试 (使用反馈提示词,最多 3 次,attempt 计数累加),不发 `WRITER_FAILED`
6. IF Writer 内部重试 3 次仍失败 THEN Writer SHALL 发布 `AGENT_FAILED` 事件 (含 agentName='writer'),由 Director 处理
7. WHEN Writer 完成 (含 CHANGES 合法) THEN Writer SHALL 发布业务事件 `DRAFT_READY` 携带正文 + 解析后的 CHANGES,**并清理 tempDraft 字段**
8. WHEN Writer 收到 `REWRITE_REQUESTED` 事件 THEN Writer SHALL 按 RewriteRequest.mode 执行整章或局部重写 (Req 19)
9. WHEN Writer 输入包含 Anchor 指纹时 (阶段 2+) THEN Writer SHALL 把指纹注入 system prompt (Req 11)
10. WHEN Writer 输入包含 Memory 数据包时 (阶段 2+) THEN Writer SHALL 把数据包内容融入 system prompt 而非 user prompt
11. WHEN 任务被恢复 AND 该 Writer 任务有 tempDraft THEN UI SHALL 询问用户是否基于 tempDraft 继续(默认是)还是从头重写

### Requirement 5: Critic Agent (编辑评审)

**User Story:** 作为作者,我希望生成的章节经过自动审稿,发现节奏问题、逻辑漏洞、文笔差的段落,这样我看到的初稿质量已经过初步把关。

#### Acceptance Criteria

1. WHEN Critic 收到 `HUMANIZED_READY` (阶段 2+) 或 `DRAFT_READY` (阶段 1) 事件 THEN Critic SHALL 从多维度审稿
2. WHEN 审稿 THEN Critic SHALL 至少检查: 节奏 (是否拖沓)、逻辑 (是否自洽)、文笔 (词汇重复/句式单调)、爽点 (是否符合蓝图情绪)
3. WHEN Critic 完成审稿 THEN Critic SHALL 为每个维度打分 (0-100) 并输出整体评价
4. WHEN 任一维度评分 < 60 THEN Critic SHALL 通过 Director 请求 Writer 整章重做,反馈具体问题
5. WHEN 评分 60-79 THEN Critic SHALL 通过 Director 请求 Writer 局部重写 (最多 2 轮,超过强制通过)
6. IF Critic 整章打回连续 3 次 THEN Critic SHALL 发布 `CRITIQUED_READY` (强制通过) 并标记章节 `pending_review`
7. WHEN Critic 通过审稿 THEN Critic SHALL 发布 `CRITIQUED_READY` 事件携带评分明细
8. IF 用户处于干预模式 THEN Critic SHALL 把修改建议展示给用户,等待用户点"应用"或"忽略"才继续

### Requirement 6: Continuity Agent (连贯性检查员)

**User Story:** 作为长篇作者,我害怕设定漂移,需要一个工具自动检查每章是否与已有事实快照矛盾,有问题不让落地。

#### Acceptance Criteria

1. WHEN Continuity 收到 `TIME_VERIFIED` (阶段 3) 或 `CRITIQUED_READY` (阶段 1+2) 事件 THEN Continuity SHALL 复用 v2.0 的 6 道生成门禁逻辑
2. WHEN 校验通过 THEN Continuity SHALL 走 **commit journal 流程** (Req 19) 完成章节落地: 章节文件、CHANGES 记录、事实快照、角色 appearanceCount、timeline 条目
3. WHEN 任意一道门禁失败 THEN Continuity SHALL 发布 `AGENT_FAILED` 事件 (agentName='continuity', 含错误详情) 由 Director 处理
4. IF 门禁连续 3 次失败 (`agent_tasks.attempt >= 3`) THEN Continuity SHALL 标记章节为 `pending_review` 并停止流水线
5. WHEN commit journal 全部步骤成功 THEN Continuity SHALL 发布业务事件 `CHAPTER_FINALIZED` (**唯一发布者**, Review #2)
6. WHEN Continuity 更新 `appearanceCount` 后跨阈值 THEN Continuity SHALL 仅更新 `entities.level` 字段并发布 `LEVEL_UP_NOTICE` 事件,**不自动生成 Anchor 内容,不修改 anchorStatus** (Review #9)
7. WHEN UI 显示门禁结果 THEN UI SHALL 列出每一道门禁的通过状态 + 错误详情

### Requirement 7: 三种用户干预模式

**User Story:** 作为不同水平的用户,我希望根据自己的需求选择干预级别 — 新手想一键省心,老手想精细控制,专业用户想改提示词。

#### Acceptance Criteria

1. WHEN 用户首次打开应用 THEN 系统 SHALL 默认使用一键模式
2. IF 用户处于一键模式 THEN 所有 Agent SHALL 自动按流水线运行,只在最终结果展示给用户
3. IF 用户处于干预模式 THEN 每个 Agent **完成后** UI SHALL 暂停并展示该 Agent 的输出,等用户点"继续"或"重做"
4. IF Writer 处于流式输出过程中 THEN 干预模式 SHALL 不在中途暂停 (避免打断流丢内容),流式结束后才暂停
5. IF 用户处于专家模式 THEN 用户 SHALL 能在每个 Agent 触发前修改其系统提示词,改动持久化
6. WHEN 用户在设置中切换模式 THEN 切换 SHALL 立即生效,但不影响正在运行的任务
7. WHEN 用户在专家模式下保存提示词修改 THEN 修改 SHALL 持久化到 `prompt_overrides` 表 (按 projectId + agentName 维度),下次打开仍然生效
8. IF 用户在干预模式下选择"重做" THEN 系统 SHALL 重新派发该 Agent 任务,可附加用户的额外指令
9. WHEN 用户在专家模式下编辑提示词 THEN UI SHALL 显示模板变量提示 (如 `{characterAnchor}` `{memoryPack}`),并校验语法合法性
10. WHEN 创世流水线 (D4) 执行时 THEN 即使是一键模式 SHALL 强制每步暂停等待用户审核

### Requirement 8: Director 工作台 UI

**User Story:** 作为用户,我希望进入项目后看到一个简洁的工作台,中间是和 Director 对话 + 实时生成区,左边是项目结构,右边是 Agent 状态和事实快照。

#### Acceptance Criteria

1. WHEN 用户打开项目 THEN UI SHALL 显示三栏布局: 左项目树 / 中工作台 / 右 Agent + 状态面板
2. WHEN 用户在工作台输入指令 THEN 系统 SHALL 在历史记录区显示用户消息和 Director 回复 (类似聊天界面)
3. WHEN 任务在运行 THEN 工作台 SHALL 实时显示流水线进度 (步骤 1✓ 步骤 2⏳ 步骤 3○) 与每步耗时
4. WHEN Director 创建父任务时 THEN UI SHALL 立即在左侧项目树插入一个 `draft` 状态的章节占位 (Req 1.2)
5. WHEN Writer 流式输出 THEN 工作台 SHALL 实时滚动显示正文,字符级追加
6. WHEN 任意 Agent 完成 THEN 右侧 Agent 面板 SHALL 显示该 Agent 的最新状态/耗时/Token 消耗
7. WHEN 用户点击 Agent 卡片 THEN UI SHALL 弹出抽屉显示该 Agent 的详细日志和输入输出
8. WHEN 任务完成 THEN 章节占位 SHALL 转为 final 状态,用户可点击切换到 Tiptap 编辑器查看/编辑
9. WHEN 右侧事实快照面板有新内容 THEN UI SHALL 用动画高亮变化的字段 (如"张三 HP -30")
10. WHEN UI 显示 Humanizer 状态时 THEN UI SHALL 展示 AI 率分数曲线 (重写每轮的分数变化)
11. WHEN UI 显示 Critic 状态时 THEN UI SHALL 展示四维度评分雷达图

### Requirement 9: Humanizer Agent (反 AI 检测) — 阶段 2

**User Story:** 作为网文作者,我希望系统能降低生成内容的 AI 痕迹,但我也知道 AI 检测器本身不稳定,系统应该有更可靠的本地度量。

(修订自 REVIEW-2026-05 #13)

#### Acceptance Criteria

1. WHEN Humanizer 收到 `DRAFT_READY` 事件 THEN Humanizer SHALL 按下列顺序处理: 规则层 → AI 重写层 → 检测层
2. WHEN 进入规则层 THEN Humanizer SHALL 应用 AI 高频词黑名单替换、句式扰动、内心戏注入 (确定性,不调 LLM)
3. WHEN 进入 AI 重写层 THEN Humanizer SHALL 用作者风格指纹 (Style) + 个性词库重写关键段落
4. WHEN 进入检测层 THEN Humanizer SHALL 计算两类指标:
   - **`detectorScore`** (外部检测器参考,可缺失): 调云端 GPTZero/Originality API,失败时记 null 不阻塞
   - **`naturalnessMetrics`** (本地可计算,**主要通过条件**): repetitionRate, sentenceLengthVariance, bannedPhraseHits, paragraphRhythmScore
5. WHEN 进入决策 THEN Humanizer SHALL 综合评估:
   - `naturalnessMetrics` 综合得分 ≥ 70 → 通过
   - 综合得分 < 70 → 递归回到规则层 (最多 5 轮)
6. WHEN 5 轮后仍未通过 THEN Humanizer SHALL 标记章节为"自然度待提升"但仍发布 `HUMANIZED_READY` 让流程继续
7. WHEN Humanizer 完成 THEN Humanizer SHALL 输出完整指标 + 各轮变化,UI 实时显示
8. WHEN 阶段 1 (MVP) 实施时 THEN Humanizer SHALL 不存在,流程跳过此步直接 Writer → Critic
9. WHEN 用户配置中关闭 Humanizer THEN 系统 SHALL 跳过此 Agent,不影响其他流程
10. WHEN detectorScore API 调用失败 THEN 系统 SHALL 仅依赖 naturalnessMetrics 决策,**不**直接通过

### Requirement 10: Memory Agent (分层记忆系统) — 阶段 2

**User Story:** 作为长篇作者,我希望写到第 200 章时,AI 还能记得第 50 章发生过什么,设定不会漂移。

#### Acceptance Criteria

1. WHEN Memory Agent 被调用 THEN Memory SHALL 构建分层记忆数据包 (L1-L6)
2. WHEN 在 ChapterPlanner / Writer 启动前 THEN Memory SHALL 自动注入与本章相关的: L1 上一章尾段 + L2 近 5 章摘要 + L3 当前快照 + L4 已完结卷归档 + L5 向量召回相关片段 + L6 涉及角色的关系图
3. WHEN 计算 L5 向量召回 THEN Memory SHALL 优先使用本地 ONNX (阶段 3),阶段 2 fallback 到 OpenAI Embedding
4. WHEN 数据包总 token 超过模型 context 80% THEN Memory SHALL 智能裁剪 (优先保留 L1+L3,L5 减半,L4 摘要化)
5. WHEN Memory 完成 THEN Memory SHALL 把数据包附在父任务的 `memoryPack` 字段供下游 Agent 使用
6. WHEN 章节生成完毕 THEN Memory SHALL 自动更新 L2 (生成本章 200 字摘要) 和 L4 (若卷完结)
7. WHEN 阶段 1 (MVP) 实施时 THEN Memory SHALL 简化为只提供 L1+L3 (上一章尾段 + 当前快照)
8. WHEN Memory 检测到 token 预算紧张 THEN Memory SHALL 在数据包元信息中标记 `truncated: true` 供 Critic 在审稿时降低苛刻度

### Requirement 11: Anchor Agent (角色性格指纹) — 阶段 2

**User Story:** 作为作者,我希望同一个角色在第 1 章和第 100 章说话方式一致,性格不漂移。

#### Acceptance Criteria

1. WHEN Anchor 被调用前 THEN Anchor SHALL 加载本章涉及角色 (来自 ChapterPlanner 蓝图) 的 Anchor 档案 + level + anchorStatus
2. WHEN 决定校验行为 THEN Anchor SHALL **严格按照 D6 决策表** 决定 (Review #9):
   - L1 + complete + strictEnabled → 完整校验 (vocab + anti_traits)
   - L1 + complete + !strictEnabled → 仅 anti_traits
   - L1 + partial → 退化为 L2 行为 (仅 anti_traits)
   - L1 + missing → 退化为 L3 行为 (跳过)
   - L2 + complete/partial → 仅 anti_traits
   - L2 + missing → 退化为 L3 行为 (跳过)
   - L3 → 始终跳过
3. WHEN 注入 Writer prompt 前 THEN Anchor SHALL 把 D6 决策表中"参与校验"的角色指纹格式化为 prompt 片段
4. WHEN Writer 完成正文后 THEN Anchor SHALL 按 D6 决策表执行对应校验
5. IF L1 角色 (complete + strict) 未命中 vocab THEN Anchor SHALL 发布 `REWRITE_REQUESTED` 事件 (mode='partial', Req 19),Writer 局部重写 (最多 2 轮)
6. IF L1+L2 角色违反 anti_trait THEN Anchor SHALL 发布 `REWRITE_REQUESTED` 事件 (mode='full'),Writer 整章重写 (最多 3 轮),失败标记 `pending_review`
7. WHEN 角色档案不存在或不完整 (例如刚升级的 L3→L2 角色,anchorStatus=missing) THEN Anchor SHALL 通过 Director 提示用户补充 (`LEVEL_UP_NOTICE` 事件携带提示),不阻塞流程
8. WHEN 阶段 1 (MVP) 实施时 THEN Anchor SHALL 不存在
9. WHEN Continuity 触发等级升级 (Req 6.6) THEN Anchor 档案 SHALL 保持空状态等待用户填充,Anchor Agent 在 anchorStatus 补全前按 D6 决策表降级处理 (修订自 #9)

### Requirement 12: Timekeeper Agent (时间线维护) — 阶段 3

**User Story:** 作为作者,我希望系统自动检查时间线,避免出现"昨天还在 A 城,今天就到了 B 山"或"三日后约定,半年后才赴约"的尴尬。

#### Acceptance Criteria

1. WHEN Timekeeper 收到 `CRITIQUED_READY` 事件 THEN Timekeeper SHALL 解析章节的时间推进 (来自 CHANGES.timeAdvance)
2. WHEN 校验时间一致性 THEN Timekeeper SHALL 检查:
   - 时间不能倒流 (本章时间不早于上一章)
   - 累计时间与 CHANGES.elapsedTime 字段一致
   - 倒计时类截止 (deadline) 是否到期需触发
3. IF 时间倒流 THEN Timekeeper SHALL 通过 Director 触发 Writer 整章重写,反馈具体冲突
4. IF 倒计时已到期但未触发 THEN Timekeeper SHALL 提示 Director,让 Director 决定下一章是否触发
5. WHEN 校验通过 THEN Timekeeper SHALL 发布 `TIME_VERIFIED` 事件 (实际写入 timeline 表的事务由 Continuity 在最终化阶段统一执行)
6. WHEN 阶段 1+2 实施时 THEN Timekeeper SHALL 不存在,时间一致性由 Continuity 兼任简化版本

### Requirement 13: 阶段 3 设计期 Agent (WorldBuilder/Character/Outliner/ChapterPlanner)

**User Story:** 作为新作者,我希望系统能从一句话 (如"修仙复仇,主角张三") 就引导我建立完整的小说世界。

#### Acceptance Criteria

1. WHEN 用户首次创建项目并提供高层意图 THEN Director SHALL 启动**创世流水线** (D4): WorldBuilder → Character → Outliner
2. WHEN 创世流水线运行时 THEN 即使一键模式 SHALL 每步暂停等待用户审核 (Req 7.10)
3. WHEN WorldBuilder 完成 THEN WorldBuilder SHALL 输出: 世界规则 (3-10 条硬约束) + 主要地点 + 主要势力,写入实体表
4. WHEN Character 完成 THEN Character SHALL 输出主角 + 5 个相关角色档案 (含 D3 等级 + Anchor 指纹),写入实体表
5. WHEN Outliner 完成 THEN Outliner SHALL 输出: 全书大纲 (50-200 章) + 分卷划分,写入大纲表
6. WHEN ChapterPlanner 在每章生成前被调用 (主流水线第一步) THEN ChapterPlanner SHALL 基于大纲 + Memory 数据包 + 用户额外指令,输出本章蓝图 (含场景清单 / 必出场角色 / 字数目标 / 视角)
7. WHEN ChapterPlanner 完成 THEN ChapterPlanner SHALL 发布 `PLAN_READY` 事件
8. WHEN 用户对设计期产出不满意 THEN 用户 SHALL 能局部重新生成 (例如只重新生成主角档案而保留世界观)
9. WHEN 阶段 1+2 实施时 THEN 这些 Agent SHALL 由用户手动填写实体档案代替

### Requirement 14: Auto-Pilot 与 Co-Pilot 模式

**User Story:** 作为不同节奏的作者,我希望既能让系统自动连写多章 (Auto-Pilot),也能逐章手动触发 (Co-Pilot,推荐模式)。

#### Acceptance Criteria

1. WHEN 用户启动 Auto-Pilot 并指定章节数 N THEN 系统 SHALL 连续生成 N 章,每章完整经过主流水线
2. WHEN Auto-Pilot 进行中任意一章被 Continuity 标记为 `pending_review` THEN 系统 SHALL 暂停 Auto-Pilot,等待用户处理
3. WHEN Auto-Pilot 进行中任意一章 AI 率超标 THEN 系统 SHALL 继续运行但累计警告,3 次后暂停
4. WHEN Auto-Pilot 进行中用户点击"暂停" THEN UI SHALL 提供两个选项:
   - **"完成当前章节后暂停"** (默认推荐)
   - **"立即中止" (放弃当前章节,标记为 `cancelled`)**
5. WHEN Co-Pilot 模式下用户每次点击"生成下一章" THEN 系统 SHALL 触发一次主流水线,完成后等待用户决定
6. WHEN 用户切换 Auto-Pilot ↔ Co-Pilot THEN 切换 SHALL 立即生效
7. WHEN Auto-Pilot 累计耗时超过 1 小时 **OR** 累计 Token 超过 500K (任一触发) THEN 系统 SHALL 主动暂停并询问用户是否继续 (避免无人值守消耗 Token)
8. WHEN 创世流水线 (D4) 执行时 THEN Auto-Pilot 模式 SHALL 不可启动,只能在创世完成后才允许

### Requirement 15: 数据持久化与恢复

**User Story:** 作为用户,我担心写到一半电脑崩了或者关错页签会丢工作,我希望任何状态都自动持久化,任何时候都能恢复。

#### Acceptance Criteria

1. WHEN Agent 任务被创建 THEN 任务记录 SHALL 立即写入 `agent_tasks` 表
2. WHEN Agent 状态变化 (started/done/failed) THEN 数据库 SHALL 同步更新
3. WHEN 语义级事件被发布 THEN 事件 SHALL 持久化到 `agent_messages` 表 (流式 chunk 不持久化,Req 2.4)
4. WHEN 用户重新打开项目 THEN 系统 SHALL 检查是否有未完成任务 (status: pending/running) 并提示恢复
5. WHEN 用户选择恢复任务 THEN 系统 SHALL 从最后一个 status=done 的子任务的下一个开始,不重复执行已完成步骤
6. WHEN 用户选择放弃任务 THEN 系统 SHALL 把任务标记为 `cancelled` 但保留历史记录用于审计
7. WHEN 章节生成成功 THEN 系统 SHALL 在一个数据库事务中同时更新章节文件、CHANGES 记录、事实快照、timeline 条目,保证原子性 (Req 6.2)

### Requirement 16: 旧功能砍除与迁移

**User Story:** 作为开发者,我希望旧的鸡肋功能被清理,代码结构清爽,新用户进来不会被一堆按钮迷惑。

#### Acceptance Criteria

1. WHEN 重构启动 THEN 系统 SHALL 删除旧的 ChapterLauncher、EngineSwitch、ScenarioPreview、ViralFlow 组件
2. WHEN 重构启动 THEN 系统 SHALL 删除旧 WorldStatePanel,功能合并到新事实快照面板
3. WHEN 重构启动 THEN 系统 SHALL 把项目的 `engineType` 字段保留但默认为 `epic`,前端不再显示双引擎选项
4. WHEN 重构启动 THEN 系统 SHALL 保留 v2.0 的 `engine/changes` `engine/snapshot` `engine/gates` 模块,改造为 Agent 内部使用
5. WHEN 老用户打开历史项目 THEN 系统 SHALL 平滑迁移已有数据,不丢失任何章节、设定、快照
6. WHEN 旧路由被访问 (如旧的拆解仿写页面) THEN UI SHALL 重定向到新工作台或显示"该功能已迁移到 XXX"
7. WHEN 老用户曾创建 viral 引擎项目 THEN 系统 SHALL 在打开时一次性把项目转为统一引擎 + 自动应用网文风格胶囊

### Requirement 17: 性能、成本与可靠性

**User Story:** 作为用户,我希望生成一章不会等太久,也不会突然炸出几块钱的账单。

#### Acceptance Criteria

1. WHEN 用户触发章节生成 THEN 系统 SHALL 遵循 D2 决策的分阶段预算 (首次顺利 ≤ 90s,含重写 ≤ 200s,绝对上限 600s)
2. WHEN 任意 Agent 单步超过其阶段预算的 1.5 倍 THEN 系统 SHALL 显示进度提示,允许用户取消
3. WHEN LLM 调用超时 (默认 120 秒) THEN 系统 SHALL 重试一次,失败后报错给用户
4. WHEN 多个独立 Agent 可以并行 THEN 系统 SHALL 并行执行 (Req 1.9)
5. WHEN 单次任务 (一章生成) 累计 Token 消耗超过 100K THEN UI SHALL 警告用户并询问是否继续
6. WHEN Auto-Pilot 累计 Token 消耗超过 500K **OR** 累计耗时超过 1 小时 (任一触发) THEN 系统 SHALL 强制暂停 (Req 14.7)
7. WHEN 系统检测到当前协议蓝图速率限制错误 (HTTP 429) THEN 系统 SHALL 触发指数退避重试 (1s/2s/4s)
8. WHEN UI 加载已有项目 THEN 加载时间 SHALL ≤ 2s (含读取最近 5 章 + 当前快照)

### Requirement 18: 角色三级模型与升级机制

**User Story:** 作为作者,我不想给一个龙套小角色也填一堆口头禅;我希望系统智能识别角色重要性。

#### Acceptance Criteria

1. WHEN 创建角色档案 THEN 用户 SHALL 能手动指定等级 (L1/L2/L3),也可让系统根据出场预测自动判定
2. WHEN 角色等级为 L1 THEN Anchor 档案 SHALL 包含完整字段 (D3 决策表)
3. WHEN 角色等级为 L2 THEN Anchor 档案 SHALL 仅包含 core_traits + anti_traits
4. WHEN 角色等级为 L3 THEN 系统 SHALL 不为该角色生成 Anchor 档案,Anchor Agent 跳过
5. WHEN Continuity 完成章节校验 THEN 系统 SHALL 更新 `entities` 表中角色的 `appearanceCount` (Req 6.6)
6. WHEN appearanceCount 跨阈值 (L3→L2: ≥2 章; L2→L1: ≥5 章) THEN 系统 SHALL **仅自动升级 `entities.level`** 并通过 Director 通知用户,**不自动生成 Anchor 内容**
7. WHEN 系统升级角色等级 THEN Director SHALL 提示用户"角色 X 已成长为 LX,建议补充档案",用户可选择立即生成 (调用 Character Agent) 或稍后 (此时 Anchor Agent 临时按更低等级处理该角色)
8. WHEN 用户手动归档角色 THEN 等级 SHALL 不再自动升级,但已有出场记录保留

### Requirement 19: Commit Journal (章节落地的两阶段提交) — 阶段 1

**User Story:** 作为系统设计者,PGlite 不支持显式事务,但章节落地涉及多步写入,我希望任何中断后都能恢复到一致状态,不会出现"章节已写但快照未更新"的脏状态。

(修订自 REVIEW-2026-05 #1)

#### Acceptance Criteria

1. WHEN Continuity 准备落地章节 THEN 系统 SHALL 在 `chapter_commits` 表写入一条 `status='preparing'` 记录,包含完整 payload (body, changes, snapshot, appearance updates)
2. WHEN 进入 commit 阶段 THEN 系统 SHALL 把 status 改为 `'committing'`,然后按顺序执行写入步骤,每完成一步更新 `currentStep` 字段
3. WHEN 全部步骤完成 THEN 系统 SHALL 把 status 改为 `'committed'`,**只有这时才发布 `CHAPTER_FINALIZED` 事件**
4. WHEN 任意一步失败 THEN 系统 SHALL 把 status 改为 `'failed'`,记录失败步骤,不发布 CHAPTER_FINALIZED
5. WHEN 应用启动 THEN 系统 SHALL 扫描 `chapter_commits` 中所有 status `IN ('preparing', 'committing')` 的记录
6. WHEN 发现未完成的 commit THEN 系统 SHALL 提示用户"检测到未完成的章节落地",提供两个选项:
   - **"继续完成"**: 从 `currentStep + 1` 继续执行剩余步骤
   - **"标记审查"**: 把章节置为 `pending_review` 并把 commit 置为 `failed`
7. WHEN commit 完成 THEN `chapter_commits` 记录 SHALL 保留 7 天作为审计日志,过期后自动归档/清理

**`chapter_commits` 表结构:**
```typescript
{
  id, projectId, parentTaskId, chapterId,
  status: 'preparing' | 'committing' | 'committed' | 'failed',
  currentStep: 0..N,           // 已完成步数
  steps: string[],              // 步骤名清单
  payload: jsonb,               // 完整待写入内容
  failedAt?: timestamp,
  failedStep?: string,
  failedError?: jsonb,
  createdAt, updatedAt
}
```

### Requirement 20: 流式草稿快照 — 阶段 1

**User Story:** 作为用户,我不希望写到第 2500 字时刷新页面就丢全部正文。

(修订自 REVIEW-2026-05 #7)

#### Acceptance Criteria

1. WHEN Writer 流式累计达到 500 字 OR 距上次快照 ≥ 2 秒 THEN 系统 SHALL 把 `tempDraft` 字段写入 `agent_tasks.output`
2. WHEN 写入 tempDraft THEN 系统 SHALL **不持久化每个 chunk** 到 agent_messages,只写入 `STREAM_DRAFT_SNAPSHOT` 业务事件 (Req 2)
3. WHEN Writer 成功完成 THEN 系统 SHALL 清理 tempDraft 字段
4. WHEN 任务被中断 (用户取消/页面刷新/崩溃) AND tempDraft 非空 THEN 任务恢复时 UI SHALL 显示 tempDraft 内容,询问用户是否基于此继续生成 (默认是)
5. WHEN 用户选择"基于 tempDraft 继续" THEN Writer SHALL 用现有内容作为前缀,继续 LLM 调用直到完成 CHANGES 段
6. WHEN 用户选择"重新开始" THEN 系统 SHALL 清理 tempDraft 后启动新 Writer 任务

### Requirement 21: 任务状态机 — 阶段 1

**User Story:** 作为系统,任务恢复时必须知道任务停在哪一步,而不是只知道"运行中"。

(修订自 REVIEW-2026-05 #6)

#### Acceptance Criteria

1. WHEN Agent 任务运行 THEN `agent_tasks.status` SHALL 是: `pending | running | done | failed | cancelled | pending_review` 之一
2. WHEN Agent 任务运行 THEN `agent_tasks.phase` SHALL 描述当前细分阶段:
   - Writer: `streaming | parsing | validating | retrying`
   - Critic: `scoring | deciding`
   - Continuity: `validating | committing`
   - 通用: `waiting_user | waiting_dependency | idle`
3. WHEN 重试发生 THEN `agent_tasks.attempt` SHALL 累加 (1, 2, 3...)
4. WHEN 任务恢复 THEN 系统 SHALL 读取 `phase + resumePoint` 决定从哪一步继续
5. WHEN 重试次数达到 D2 决策表上限 THEN 系统 SHALL 拒绝继续重试,标记 pending_review
6. WHEN 任务完成 THEN `phase` SHALL 被清空 (NULL)

### Requirement 22: TokenBudget 服务 — 阶段 2

**User Story:** 作为系统,Memory Pack 不能盲目构建,必须知道当前模型 context 上限,合理分配预算。

(修订自 REVIEW-2026-05 #12)

#### Acceptance Criteria

1. WHEN 协议蓝图被定义 THEN 蓝图 SHALL 包含 `defaultContextLength` 字段,描述该协议下模型默认 context 上限
2. WHEN 用户扫描模型时 (model-scanner) THEN 系统 SHALL 尝试从模型元数据提取 `contextLength`,存入用户的模型配置
3. WHEN 任意 Agent 准备调用 LLM THEN Agent SHALL 通过 `TokenBudgetService.allocate({ model, system, blueprint, memory, output })` 申请 token 预算
4. WHEN 估算 token 数 THEN 系统 SHALL 用 tiktoken 兼容算法 (中文按 1.5 字符/token 估算)
5. WHEN Memory Agent 构建 Pack THEN Memory SHALL 接收上游传入的 `maxTokens` 参数,不自行决定
6. IF Pack 超过 80% context THEN Memory SHALL 按"L1+L3 优先 → L5 减半 → L4 摘要化"顺序裁剪 (Req 10.4)
7. WHEN LLM 调用前 THEN Agent SHALL 校验 `estimateTokens(systemPrompt + userPrompt) ≤ allocatedBudget`,否则降级 (减少 Pack/降低 maxTokens)

### Requirement 23: RewriteRequest 数据结构 — 阶段 1

**User Story:** 作为 Critic,我请求 Writer 改一段文字时必须明确改哪里、改成什么,而不是模糊指令。

(修订自 REVIEW-2026-05 #10)

#### Acceptance Criteria

1. WHEN Critic 或 Anchor 请求 Writer 重写 THEN SHALL 通过 `REWRITE_REQUESTED` 事件携带 `RewriteRequest` 结构
2. WHEN `mode='partial'` THEN RewriteRequest SHALL 包含 `targetRanges`: 数组,每项含 `startOffset`, `endOffset`, `reason`, `instruction`
3. WHEN `mode='full'` THEN RewriteRequest SHALL 包含 `feedback` 字符串,Writer 整章重写
4. WHEN `mode='partial'` THEN Writer SHALL 仅改写指定范围,保留其他内容
5. WHEN `preserveChanges=false` (默认) THEN Writer 重写后 SHALL 重新生成 CHANGES 段并通过 Continuity 重新校验
6. WHEN `preserveChanges=true` THEN Writer SHALL 保留原 CHANGES 不变 (仅当 reviewer 明确知道改动不影响状态时使用,如修标点/排版)
7. WHEN Writer 接收到 RewriteRequest THEN Writer SHALL 在新一轮 attempt 计数下执行,attempt 累加

**`RewriteRequest` 类型:**
```typescript
type RewriteRequest = {
  mode: 'partial' | 'full'
  targetRanges?: Array<{
    startOffset: number
    endOffset: number
    reason: string
    instruction: string
  }>
  feedback: string             // 整章重写时的整体反馈
  preserveChanges: boolean
  mustReparseChanges: boolean
}
```

### Requirement 24: Critic 输出 Schema 校验 — 阶段 1

**User Story:** 作为系统,Critic 调 LLM 输出 JSON 经常格式不稳定,必须用 Schema 严格校验,不让坏数据传到下游。

(修订自 REVIEW-2026-05 #11)

#### Acceptance Criteria

1. WHEN Critic 收到 LLM 响应 THEN Critic SHALL 用 Zod Schema 校验 (引入 `zod` 依赖)
2. WHEN Schema 校验失败 THEN Critic SHALL 重试 LLM 调用 (最多 2 次,带"格式错误反馈"提示)
3. WHEN 重试 2 次仍失败 THEN Critic SHALL 强制通过 (评分按各维度 70 分计) 并标记 `pending_review`
4. WHEN Schema 校验成功 THEN Critic SHALL 用 `decision` 字段决定后续行为 (`pass | partial_rewrite | full_rewrite`)

**Critic 输出 Schema:**
```typescript
const CriticResultSchema = z.object({
  scores: z.object({
    pacing: z.number().min(0).max(100),
    logic: z.number().min(0).max(100),
    prose: z.number().min(0).max(100),
    satisfaction: z.number().min(0).max(100),
  }),
  decision: z.enum(['pass', 'partial_rewrite', 'full_rewrite']),
  issues: z.array(z.object({
    dimension: z.enum(['pacing', 'logic', 'prose', 'satisfaction']),
    severity: z.enum(['low', 'medium', 'high']),
    location: z.object({
      startOffset: z.number(),
      endOffset: z.number(),
    }).optional(),
    suggestion: z.string()
  }))
})
```

### Requirement 25: 取消机制 — 阶段 1

**User Story:** 作为用户,我点取消后系统必须真停下来,不能取消后还把结果落库。

(修订自 REVIEW-2026-05 #17)

#### Acceptance Criteria

1. WHEN 用户点击取消 THEN Director SHALL 设置 `agent_tasks.status='cancelled'` 并 abort 父任务的 `AbortController`
2. WHEN 任意 Agent 调用 LLM THEN 调用 SHALL 传入 `signal: ctx.abortSignal`
3. WHEN AbortSignal 触发 THEN 协议蓝图层 (`streamChatCompletion`) SHALL 立即终止 fetch
4. WHEN 流式调用被 abort THEN Agent SHALL 抛 `AbortError`,不继续处理
5. WHEN 非流式调用 abort 后结果仍返回 THEN Agent SHALL 在落库前必须执行 `await assertTaskNotCancelled(taskId)`,如已取消则丢弃结果
6. WHEN Continuity 进入 commit journal 流程后被取消 THEN 系统 SHALL 等当前步骤完成,然后回滚已写部分,标记 commit `failed`
7. WHEN 任务恢复时发现已被取消 THEN 系统 SHALL 不恢复该任务

### Requirement 26: 协议蓝图统一流式接口 — 阶段 2

**User Story:** 作为 Writer,我不应该关心 OpenAI 用 `delta.content` 还是 Anthropic 用 `content_block_delta`。

(修订自 REVIEW-2026-05 #15, 阶段 2 重构)

#### Acceptance Criteria

1. WHEN 协议蓝图层提供流式接口 THEN 接口 SHALL 返回统一的 `StreamEvent` 序列
2. WHEN Writer 消费流式 THEN Writer SHALL 仅处理 `text_delta` 事件,不处理协议特有字段

**StreamEvent 类型:**
```typescript
type StreamEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'usage'; usage: { promptTokens: number; completionTokens: number } }
  | { type: 'tool_call'; ... }      // 预留未来扩展
  | { type: 'done' }
  | { type: 'error'; error: { code: string; message: string } }
```

3. WHEN 阶段 1 实施时 THEN 协议层保留现有回调接口 (`onChunk(text)`),Req 26 在阶段 2 重构

### Requirement 27: prompt_overrides 版本管理 — 阶段 1

**User Story:** 作为专家用户,我改坏了 prompt 想回滚到上一版,但又不想丢失自己的修改历史。

(修订自 REVIEW-2026-05 #16)

#### Acceptance Criteria

1. WHEN 用户在专家模式保存 prompt 修改 THEN 系统 SHALL 创建一个新版本 (`version=N`),并把旧版本的 `isActive=false`
2. WHEN 保存前 THEN 系统 SHALL 校验模板变量 (`{characterAnchor}`, `{memoryPack}` 等)
3. IF 校验发现未知变量 OR 缺失必需变量 THEN 系统 SHALL 在 `validationErrors` 字段记录警告,**仍允许保存**(用户可能故意去掉变量)
4. WHEN Agent 调用时 THEN 系统 SHALL 使用 `isActive=true` 的最新版本
5. WHEN 用户点"回滚到上一版" THEN 系统 SHALL 把当前版本 `isActive=false`,把上一版 `isActive=true`
6. WHEN 同一 (projectId, agentName) 历史版本超过 10 个 THEN 系统 SHALL 自动清理最早的非活跃版本

**`prompt_overrides` 表结构:**
```typescript
{
  id, projectId, agentName,
  version: number,                     // 1, 2, 3...
  promptTemplate: text,
  isActive: boolean,
  validationErrors: jsonb,             // [{ var: 'unknownVar', severity: 'warning' }]
  createdAt, updatedAt
}
```

### Requirement 28: budgetSession 跨任务累计 — 阶段 1

**User Story:** 作为 Auto-Pilot 用户,我希望系统准确知道我累计花了多少 token,而不是临时聚合。

(修订自 REVIEW-2026-05 #18)

#### Acceptance Criteria

1. WHEN 用户启动 Auto-Pilot OR 单章生成 THEN 系统 SHALL 创建一条 `budget_sessions` 记录
2. WHEN 任意 Agent 调用 LLM 完成 THEN 系统 SHALL 原子累加 `budget_sessions.tokenUsed += tokensThisCall`
3. WHEN `tokenUsed` 跨过 `maxTokens * 0.8` THEN 系统 SHALL 在 UI 显示警告
4. WHEN `tokenUsed >= maxTokens` THEN 系统 SHALL 强制暂停所有正在运行的任务并通知用户 (Req 17.6)
5. WHEN 会话结束 (Auto-Pilot 完成 / 用户停止 / 单章完成) THEN 系统 SHALL 把 session 标记为 `ended`
6. WHEN UI 加载项目 THEN UI SHALL 显示该项目所有历史 session 的 token 累计统计

**`budget_sessions` 表结构:**
```typescript
{
  id, projectId,
  mode: 'chapter' | 'autopilot',
  tokenUsed: number,
  maxTokens: number,
  startedAt: timestamp,
  endedAt: timestamp | null,
  status: 'active' | 'ended' | 'aborted'
}
```

### Requirement 29: RuntimeMode 差异化能力 — 阶段 1

**User Story:** 作为浏览器用户,我知道标签页休眠会让长任务卡住,系统应该针对这点做保护。

(修订自 REVIEW-2026-05 #14, D7 决策)

#### Acceptance Criteria

1. WHEN 系统启动 THEN 系统 SHALL 检测当前是 `browser` 还是 `tauri` 运行时,存入全局状态
2. WHEN RuntimeMode='browser' THEN Auto-Pilot 单次会话 SHALL 限制最多 5 章
3. WHEN RuntimeMode='browser' THEN 系统 SHALL 监听 `document.visibilitychange`,标签页隐藏 ≥5 分钟自动暂停 Auto-Pilot
4. WHEN RuntimeMode='tauri' THEN 限制按 Req 14.7 (1 小时或 500K token)
5. WHEN UI 显示模式徽章 THEN UI SHALL 在右下角显示当前 RuntimeMode (供用户感知)

系统 Agent/UI 须使用如下标准错误码:

| 错误码 | Agent | 含义 | 用户可见消息 |
|--------|-------|------|-------------|
| `E_LLM_TIMEOUT` | 任意 | LLM 调用超时 | "LLM 响应超时,可能是网络或 API 限速" |
| `E_LLM_AUTH` | 任意 | API Key 无效 | "API Key 鉴权失败,请检查配置" |
| `E_LLM_RATELIMIT` | 任意 | HTTP 429 | "API 限速,正在重试..." |
| `E_PROTOCOL_PARSE_FAILED` | Writer | CHANGES 段解析失败 | "AI 输出格式错误,正在重试" |
| `E_GATE_FAILED` | Continuity | 6 道门禁失败 | "章节与现有设定冲突,需要修改" |
| `E_AI_RATE_HIGH` | Humanizer | 5 轮后仍超 30% | "AI 率优化失败,建议人工修改" |
| `E_ANCHOR_VIOLATION` | Anchor | 违反 anti_trait | "角色性格不一致,正在重写" |
| `E_TIMELINE_INVALID` | Timekeeper | 时间倒流 | "时间线异常,正在修正" |
| `E_NO_PREREQUISITE` | Director | 不满足 D5 条件 | "请先完善基础设定再生成" |
| `E_BUDGET_EXCEEDED` | 任意 | 超过 token/时间预算 | "已暂停,等待您确认是否继续" |
| `E_CONFLICT_USER_INTENT` | Director | 用户指令与现有设定冲突 | "您的指令与设定冲突,请确认" |

## 三、与现有系统的关系

### 3.1 复用现有引擎

| v2.0 模块 | 在 v3.0 中的角色 | 阶段 |
|----------|------------------|------|
| `engine/changes` (CHANGES 协议) | Writer Agent 输出契约 | 1 |
| `engine/snapshot` (15 维快照) | Memory L3 + Continuity 投影 | 1 |
| `engine/gates` (6 道门禁) | Continuity Agent 主体 | 1 |
| `engine/pack` (数据中心打包) | Memory Agent 内部使用 | 2 |
| `engine/prompts/chapter` | Writer Agent 提示词模板 | 1 |
| `ai/protocol/*` (协议蓝图) | 所有 Agent 的 LLM 调用 | 1 |

### 3.2 新增数据库表

阶段 1 必须:
- `agent_tasks` — Agent 任务记录 (含 phase/attempt/resumePoint, Req 21)
- `agent_messages` — 消息总线持久化 (反范式: parentTaskId/agentName/chapterId, Review #5)
- `prompt_overrides` — 专家模式下的提示词覆盖 (含 version, Req 27)
- `chapter_commits` — Commit Journal (Req 19)
- `budget_sessions` — Token 预算会话 (Req 28)

阶段 2 新增:
- `author_styles` — 作家风格指纹 (Humanizer 用)
- `ai_detection_logs` — AI 率检测记录 + 本地 naturalnessMetrics

阶段 3 新增:
- `timeline` — 时间线事件
- `volume_archives` — 卷级归档 (Memory L4 用)

### 3.3 实体表扩展

在 `entities` 表新增:
- `level` — 角色等级 (L1/L2/L3),仅 type=character 有效
- `appearanceCount` — 出场章节数
- `anchor` — JSON,存储 Anchor 档案 (vocabulary_signature, sentence_style, traits...)
- `anchorStatus` — `'missing' | 'partial' | 'complete'` (Review #9, D6)
- `anchorStrictEnabled` — boolean,用户可手动关闭某角色的严格 Anchor 校验
- `lastAppearedChapter` — 最后出场章节序号
- `levelManuallyLocked` — boolean,用户手动归档则禁止自动升级

## 四、约束与假设

### 技术约束

- 仍使用 Next.js 14 + Tauri 2 + PGlite + Tiptap
- 所有 Agent 都跑在客户端,不引入服务端 Worker
- 不依赖外部消息队列,用 in-memory + DB 持久化模拟总线
- 阶段 3 的 ONNX 模型须 < 50MB,加载延迟 < 3s

### 业务约束

- 单次生成 (一章) 累计 Token 上限: 100K (Req 17.5)
- Auto-Pilot 单次会话默认上限: 500K token 或 1 小时 (任一触发)
- 用户最低配置: 一个能跑 OpenAI 兼容协议的 LLM Key

### 假设

- 用户至少配置好了一个 LLM (已通过测试连接)
- 章节生成前,项目须满足 D5 最低前置条件
- 阶段 3 用户能从零创建项目,但创世流水线 (D4) 强制要求用户审核每步

## 五、成功标准

### 阶段 1 (MVP)
| 指标 | 目标 |
|------|------|
| 章节生成成功率 (一次过 6 道门禁) | ≥ 70% |
| 平均生成耗时 (3000 字章节,首次顺利) | ≤ 90s |
| 用户能在不读文档的情况下完成首次章节生成 | 90% 用户 |
| 一键模式下用户无需中途干预即可完成章节 | 80% 案例 |

### 阶段 2
| 指标 | 目标 |
|------|------|
| 生成内容 detectorScore (云端检测器,仅作参考) | ≤ 30% |
| 本地 naturalnessMetrics 综合评分 (Review #13) | ≥ 70/100 |
| 角色性格一致性 (人工抽查 100 章) | ≥ 90% |
| Memory 数据包 token 利用率 | ≥ 85% (避免过度裁剪) |

### 阶段 3
| 指标 | 目标 |
|------|------|
| 设定漂移率 (200 章规模人工评估) | ≤ 5% |
| 时间线错误数 (200 章规模) | ≤ 3 处 |
| 从零创建项目到生成第 1 章 | ≤ 5 分钟 |
| 端到端生成总成本 (10 万字,GPT-4o-mini 基线) | ≤ $5 |
