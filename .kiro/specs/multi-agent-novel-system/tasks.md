# Implementation Plan

CLwriter v3.0 — 多 Agent 协作小说创作系统

> **使用方式**: 任务从上往下做,每完成一项后把 `[ ]` 改成 `[x]`。子任务全部完成后才标记父任务。每个任务都列出对应的 Requirement 编号方便回查。

## 阶段 1: MVP (4 个核心 Agent + 新 UI)

### 准备工作

- [ ] 1. 数据库 Schema 扩展
  - 在 `src/lib/db/schema.ts` 新增 `agentTasks` 表 (字段见 design.md §2.6)
    - **含 phase / resumePoint / attempt 字段** (Req 21, Review #6)
  - 在 `src/lib/db/schema.ts` 新增 `agentMessages` 表 (反范式: parentTaskId/agentName/chapterId, Review #5)
  - 在 `src/lib/db/schema.ts` 新增 `promptOverrides` 表 (含 version/isActive/validationErrors, Req 27)
  - 在 `src/lib/db/schema.ts` 新增 `chapterCommits` 表 (Req 19, commit journal)
  - 在 `src/lib/db/schema.ts` 新增 `budgetSessions` 表 (Req 28)
  - 在 `entities` 表新增字段: `level`, `appearanceCount`, `anchor`, `anchorStatus`, `anchorStrictEnabled`, `lastAppearedChapter`, `levelManuallyLocked`
  - 用 `npx drizzle-kit generate` 生成 migration 文件
  - _Requirements: 1.4, 2.3, 7.7, 18.2, 18.5, 19, 21, 27, 28_

- [ ] 2. 旧组件归档
  - 在 `src/components/` 下创建 `_archive/v2/` 目录
  - 把以下组件移到 `_archive/v2/`: `editor/ChapterLauncher.tsx`, `editor/EngineSwitch.tsx`, `editor/ViralFlow.tsx`, `sidebar/scenario-preview.tsx`, `sidebar/ViralSidebar.tsx`, `sidebar/WorldStatePanel.tsx`
  - 在主项目代码里搜索这些旧组件的导入,改为 `// @deprecated, archived in _archive/v2/` 注释
  - 验证 `npx next build` 通过 (即使有警告也接受)
  - _Requirements: 16.1, 16.2_

- [ ] 3. 老项目自动迁移逻辑
  - 创建 `src/lib/migration/v2-to-v3.ts`,实现 `migrateV2ToV3(projectId)` 函数
    - 把 `engineType='viral'` 项目转成 `engineType='epic'` 并标记需要应用网文风格胶囊
    - 给所有现有 character 实体设置 `level='L2'` 默认值
    - 重新计算每个角色的 `appearanceCount` (扫描 chapter_changes 表)
  - 在项目首次打开时自动调用 (在 `src/app/editor/[projectId]/page.tsx`)
  - _Requirements: 16.3, 16.5, 16.7_

### 核心抽象层

- [ ] 4. Agent 基类与共享类型
  - 创建 `src/lib/agents/core/types.ts`,定义 `AgentContext`, `AgentResult`, `Task`, `BusMessage`, `RewriteRequest` (代码见 design.md §2.4.1, Req 23)
  - 创建 `src/lib/agents/core/errors.ts`,定义 11 个标准错误码常量
  - 创建 `src/lib/agents/core/events.ts`,定义两类事件常量:
    - **生命周期事件**: `AGENT_STARTED / AGENT_FINISHED / AGENT_FAILED / AGENT_PROGRESS / STREAM_CHUNK / STREAM_DRAFT_SNAPSHOT` (Review #3)
    - **业务语义事件**: `PLAN_READY / DRAFT_READY / HUMANIZED_READY / CRITIQUED_READY / TIME_VERIFIED / CHAPTER_FINALIZED / RETRY_REQUESTED / REWRITE_REQUESTED / USER_DECISION / PIPELINE_PAUSED / PIPELINE_COMPLETED / LEVEL_UP_NOTICE`
  - 创建 `src/lib/agents/core/agent.ts`,实现 `BaseAgent<TInput, TOutput>` 抽象类
    - **publishStart/Done/Failed 用统一事件名 `AGENT_*`,在 payload 中标识 agentName** (Review #3)
  - _Requirements: 1, 2.1_

- [ ] 5. 消息总线
  - 创建 `src/lib/agents/core/bus.ts`,实现 `MessageBus` 类
  - 实现 `publish()`, `on()`, `subscribeAll()` 方法
  - 实现 `isStreamChunk()` 判断 (流式不持久化)
  - 实现 `persist()` 写入 `agent_messages` 表
  - 单例化 (导出 `bus` 全局实例)
  - _Requirements: 2.1, 2.3, 2.4, 2.5_

- [ ] 6. 任务持久化层
  - 创建 `src/lib/agents/core/task-store.ts`
  - 实现 `createTask(input)`, `updateTaskStatus(id, status)`, `getTask(id)`, `getChildTasks(parentId)`
  - 实现 `markTaskCompleted(id, output)`, `markTaskFailed(id, error)`
  - **新增 `updateTaskState(id, { phase, resumePoint, attempt })`** (Req 21, Review #6)
  - **新增 `assertTaskNotCancelled(id)` 抛异常如已取消** (Req 25, Review #17)
  - **新增 `persistTempDraft(id, text)` / `clearTempDraft(id)`** 写入 `output.tempDraft` 字段 (Req 20, Review #7)
  - 用 drizzle 直接操作 `agentTasks` 表
  - _Requirements: 1.4, 15.1, 15.2, 20, 21, 25_

- [ ] 7. 任务恢复机制
  - 创建 `src/lib/agents/core/recovery.ts`
  - 实现 `detectUnfinishedTasks(projectId)`
  - 实现 `resumeTask(parentTask)`,从最后已完成子任务的下一步继续 (基于 `phase + resumePoint + attempt`, Req 21)
  - **实现 `recoverChapterCommits()` 扫描 stuck 状态的 chapter_commits 提示用户处理** (Req 19, Review #1)
  - **实现 `detectTempDrafts(projectId)` 找到未完成 Writer 任务的草稿,UI 询问基于此继续还是重新开始** (Req 20, Review #7)
  - 创建 `RestorePromptDialog` 组件,在编辑器加载时检测并提示用户
  - _Requirements: 1.7, 15.4, 15.5, 19, 20_

- [ ] 8. 流水线编排器
  - 创建 `src/lib/agents/core/orchestrator.ts`
  - 实现 `Orchestrator` 类的 `runMVP(parentTask, input)` 方法
  - 实现取消检查 (`abortSignal` 集成, Req 25)
  - 实现干预模式的 `waitForUserConfirm()` (Promise + bus.on 模式)
  - 实现 `markPendingReview()` 标记章节状态
  - **流水线全部完成后只发布 `PIPELINE_COMPLETED` 运行时事件,不发布 `CHAPTER_FINALIZED`** (Review #2)
  - **`CHAPTER_FINALIZED` 业务事件唯一发布者是 Continuity Agent**
  - _Requirements: 1.5, 1.10, 7.3, 25_

### Director Agent

- [ ] 9. Director Agent 实现
  - 创建 `src/lib/agents/director/index.ts`,继承 `BaseAgent`
  - 实现 `startGenerateChapter(projectId, options)`:
    - 调 `checkPrerequisites()` 校验 D5 基础门槛
    - 创建 draft 章节占位 (调 `createFile` 设置 `metadata.status='draft'`)
    - 创建父任务
    - 启动 Orchestrator
  - 实现 `handleFailure(ctx, stepName, error)` 决策方法 (重试/中止)
  - 实现 `checkPrerequisites(projectId)`: **按 D5 决策表只检查基础门槛** (Review #8):
    - ≥1 个主角实体 (`type='character'`,等级不强求)
    - ≥1 条世界观规则
    - LLM 已配置且测试通过
    - **不要求 L1 角色或完整 Anchor** (Anchor 是阶段 2 才有的能力)
  - _Requirements: 3.1, 3.5, 3.9, 1.2, D5_

- [ ] 10. Director 意图解析器 (MVP 简化版)
  - 创建 `src/lib/agents/director/intent-parser.ts`
  - 支持模板化指令: `generate-next-chapter`, `regenerate-chapter`, `review-pending`
  - 不需要 LLM 调用,基于关键词匹配即可
  - _Requirements: 3.1, 3.7_

### Writer Agent

- [ ] 11. Writer Agent 实现
  - 创建 `src/lib/agents/writer/index.ts`,继承 `BaseAgent`
  - 实现 `run(ctx, input)`:
    - 用 `streamChatCompletion()` 流式调用 LLM,**传入 `signal: ctx.abortSignal`** (Req 25, Review #17)
    - 把每个 chunk 通过 `bus.publish('STREAM_CHUNK', ...)` 转发 (in-memory only)
    - **每 500 字 OR 每 2 秒调用 `persistTempDraft()` 写入草稿** (Req 20, Review #7)
    - 累积完整文本,调用 `parseChanges()` 解析 CHANGES 段
    - CHANGES 解析失败时自重试 (最多 3 次,带反馈 prompt,**更新 attempt 字段**)
    - **每次 LLM 调用前后用 `ctx.abortSignal.throwIfAborted()` 检查取消** (Req 25)
    - **完成后调 `clearTempDraft()` 清理草稿,显式发布业务事件 `DRAFT_READY`** (Review #3)
  - **实现 `handleRewriteRequest(ctx, req, prevDraft)` 处理 Critic/Anchor 的局部重写** (Req 23, Review #10)
  - 复用 v2.0 的 `engine/changes/parser.ts` 和 `engine/prompts/chapter.ts`
  - _Requirements: 4.1, 4.2, 4.3, 4.5, 4.6, 4.7, 4.8, 19, 20, 23, 25_

- [ ] 12. Writer Prompt 构建
  - 创建 `src/lib/agents/writer/prompts.ts`
  - 实现 `buildSystemPrompt(input)`: 基础写作指令 + CHANGES 协议要求
  - 实现 `buildUserPrompt(input)`: 章节蓝图 + 上下文数据包 (memoryPack 阶段 1 简化)
  - 实现 `appendRetryFeedback(prompt, error, attempt)`: 重试时附加错误反馈
  - _Requirements: 4.7, 4.8_

### Critic Agent

- [ ] 13. Critic Agent 实现
  - 创建 `src/lib/agents/critic/index.ts`,继承 `BaseAgent`
  - 实现 `run(ctx, input)`: 用 LLM 给 4 维评分 (节奏/逻辑/文笔/爽点) + JSON 输出
  - **用 Zod Schema 严格校验 LLM 输出** (Req 24, Review #11)
  - 实现 `makeDecision(scores)`: 根据 D2 阈值 (60/80) 决策
  - 决策结果通过总线发布:
    - `pass` → 业务事件 `CRITIQUED_READY`
    - `partial-rewrite` → `REWRITE_REQUESTED` (含 `RewriteRequest`,mode='partial', Req 23)
    - `full-rewrite` → `REWRITE_REQUESTED` (mode='full')
  - 限制: 局部重写最多 2 轮,整章重写最多 3 次
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 23, 24_

- [ ] 14. Critic 评分逻辑 + Zod Schema
  - 创建 `src/lib/agents/critic/scoring.ts`
  - **引入 zod 依赖,定义 `CriticResultSchema`** (Req 24, Review #11)
  - 实现 `parseScores(llmResponse)`: 健壮的 JSON 提取 (处理 markdown code block 包裹) + Zod 校验
  - **校验失败时自动重试 LLM 2 次,仍失败则强制通过 70 分并标记 pending_review**
  - 实现 `buildSuggestions(scores)`: 把每维度的低分转换成可读建议
  - 实现 `buildRewriteRequest(decision, issues)`: 构建结构化 RewriteRequest (Req 23)
  - _Requirements: 5.3, 23, 24_

### Continuity Agent

- [ ] 15. Continuity Agent 实现
  - 创建 `src/lib/agents/continuity/index.ts`,继承 `BaseAgent`
  - 实现 `run(ctx, input)`:
    - **更新 phase='validating'** (Req 21)
    - 调 `runAllGates()` 执行 6 道门禁 (复用 v2.0 的 `engine/gates/orchestrator.ts`)
    - 失败 → throw `E_GATE_FAILED`,带门禁反馈
    - 成功 → **更新 phase='committing',调 `commitWithJournal()`** (Req 19, Review #1)
    - **commit 完成后显式发布业务事件 `CHAPTER_FINALIZED`** (唯一发布者, Review #2)
  - 限制: 失败重试 3 次 (基于 `attempt` 字段),然后标记 `pending_review`
  - _Requirements: 6.1, 6.3, 6.4, 6.5, 19, 21_

- [ ] 16. Continuity Commit Journal
  - 创建 `src/lib/agents/continuity/commit-journal.ts` (替代旧的 transaction.ts)
  - 实现 `commitWithJournal(ctx, input, newSnap)`:
    1. 在 `chapter_commits` 写 status='preparing' 记录,含完整 payload
    2. 标记 status='committing'
    3. 顺序执行 4 步,每步前 `assertTaskNotCancelled()` (Req 25)
    4. 每完成一步原子更新 `currentStep`
    5. 全部完成 → status='committed'
    6. 任意失败 → status='failed' + 记录 failedStep/failedError
  - 实现 4 个步骤函数:
    - `updateFile(chapterId, body)` (draft → final)
    - `insertChapterChange(chapterId, changes)`
    - `saveSnapshot(commitId, newSnap)`
    - `updateAppearanceCounts(chapterId, changes)` 含等级升级 (Req 6.6, 18.6)
  - **等级升级时仅更新 `entities.level`,不修改 `anchorStatus`** (Review #9)
  - **升级时发布 `LEVEL_UP_NOTICE` 业务事件** (Req 18.7)
  - _Requirements: 6.2, 6.6, 18.6, 18.7, 19, 25_

### UI 工作台

- [ ] 17. 三栏布局重构
  - 修改 `src/app/editor/[projectId]/page.tsx`,使用三栏 ResizablePanel
  - 左栏: 改造现有 `LeftSidebar.tsx` 为 `ProjectTree.tsx`,只保留项目结构,移除旧业务功能
  - 中栏: 创建 `src/components/workbench/DirectorWorkbench.tsx` 主容器
  - 右栏: 复用 v2.0 `EnginePanel`,顶部增加 Agent 状态卡片
  - _Requirements: 8.1_

- [ ] 18. Director 工作台主组件
  - 创建 `src/components/workbench/DirectorWorkbench.tsx`
  - 实现三个子区域: ChatPanel (上) + PipelineStatus (中) + StreamPreview (下)
  - 顶部 Header 加"生成下一章"按钮和模式选择器 (一键/干预/专家)
  - _Requirements: 8.2, 8.3_

- [ ] 19. ChatPanel 对话框
  - 创建 `src/components/workbench/ChatPanel.tsx`
  - 显示用户消息和 Director 回复历史
  - 输入框 + 发送按钮
  - 当 Director 完成任务时自动追加摘要消息
  - _Requirements: 8.2, 3.6_

- [ ] 20. PipelineStatus 流水线进度
  - 创建 `src/components/workbench/PipelineStatus.tsx`
  - 用 `useTaskStream(taskId)` hook 订阅总线
  - 显示每个 Agent 的状态 (○/⏳/✓/✗) + 耗时 + Token 数
  - 失败的 Agent 显示错误码和重试按钮
  - _Requirements: 8.3, 8.6_

- [ ] 21. StreamPreview 流式预览
  - 创建 `src/components/workbench/StreamPreview.tsx`
  - 监听 `WRITER_CHUNK` 事件,实时追加显示
  - 用 `requestAnimationFrame` 节流渲染避免卡顿
  - _Requirements: 8.5_

- [ ] 22. AgentDrawer 详情抽屉
  - 创建 `src/components/workbench/AgentDrawer.tsx`
  - 点击 PipelineStatus 中的 Agent 卡片打开
  - 显示该 Agent 的: 输入 / 输出 / 完整对话 / metrics
  - 提供"复制提示词"按钮,方便调试
  - _Requirements: 8.7_

- [ ] 23. Hook: useTaskStream
  - 创建 `src/hooks/useTaskStream.ts`
  - 订阅 `bus.subscribeAll`,过滤当前 taskId 的消息
  - 维护 `agentStates` map 和 `streamText` 字符串
  - 返回 `{ agentStates, streamText }`
  - _Requirements: 2.5_

- [ ] 24. Hook: useChapterDraft
  - 创建 `src/hooks/useChapterDraft.ts`
  - 监听 `chapterId` 变化,自动加载对应 task 状态
  - 提供 `regenerate()`, `accept()`, `discard()` 方法 (用于 pending_review)
  - _Requirements: 1.10, 8.4, 8.8_

### 干预模式 + 专家模式

- [ ] 25. 模式切换设置
  - 在 `SettingsDialog.tsx` 新增"创作模式"选项 (radio: auto/review/expert)
  - 持久化到 localStorage
  - 当前活跃模式存到 zustand store 中,所有组件可读取
  - _Requirements: 7.1, 7.6_

- [ ] 26. 干预模式 UI
  - 在 `PipelineStatus` 中,当 `agentStates[xx].status === 'awaiting-review'` 时显示"继续/重做/修改"按钮
  - 点击发送 `USER_DECISION` 事件到总线
  - _Requirements: 7.3, 7.8_

- [ ] 27. 专家模式 UI
  - 创建 `src/components/workbench/PromptEditor.tsx`
  - 在 AgentDrawer 内嵌入 (仅专家模式可见)
  - 显示当前提示词 + 可编辑文本框
  - 模板变量提示 (硬编码列表)
  - **保存到 `prompt_overrides` 表,使用版本化机制** (Req 27, Review #16):
    - 每次保存创建新 version,旧版本 isActive=false
    - 保存前调 `validatePromptVars()` 校验模板变量
    - 校验失败时记录 `validationErrors` 但允许保存
  - **提供"回滚到上一版"按钮** (Req 27)
  - _Requirements: 7.4, 7.5, 7.7, 7.9, 27_

- [ ] 27a. Prompt 版本管理服务
  - 创建 `src/lib/agents/core/prompt-store.ts`
  - 实现 `getActivePrompt(projectId, agentName)` (返回 isActive=true 的最新版本)
  - 实现 `savePrompt(projectId, agentName, template)` (创建新版本)
  - 实现 `rollbackPrompt(projectId, agentName)` (上一版生效)
  - 实现 `validatePromptVars(template, allowedVars)` 模板变量校验
  - 实现 `cleanupOldVersions(projectId, agentName, keep=10)` 自动清理
  - _Requirements: 27_

- [ ] 28. 创世流水线强制审核 (D4 占位)
  - 即使一键模式,创世流水线 (阶段 3 实现) SHALL 强制每步暂停
  - 阶段 1 用 placeholder: 当用户首次创建项目时,提示"请手动创建至少 1 个主角实体 + 1 条世界观规则后再生成章节"
  - _Requirements: 7.10, 13.2_

- [ ] 28a. RuntimeMode 检测与差异化能力
  - 创建 `src/lib/agents/core/runtime.ts`
  - 实现 `detectRuntime()` 返回 `'browser' | 'tauri'`
  - 把 RuntimeMode 存入全局 zustand store
  - **browser 模式: 监听 `document.visibilitychange`,标签页隐藏 ≥5 分钟暂停 Auto-Pilot** (Req 29)
  - **browser 模式: Auto-Pilot 单次最多 5 章** (Req 29)
  - UI 右下角显示运行时徽章
  - _Requirements: 29, D7_

- [ ] 28b. Token 预算服务 (基础版,阶段 1 简化)
  - 创建 `src/lib/agents/core/token-budget.ts`
  - 实现 `estimateTokens(text)` 简单估算 (英文 4 字符/token,中文 1.5 字符/token)
  - 实现 `getModelContextLimit(blueprintId, modelId)` 从协议蓝图读取
  - 实现 `BudgetSession` 类管理跨任务累计 (Req 28, Review #18):
    - `start(projectId, mode, maxTokens)` 创建 budget_sessions 记录
    - `recordUsage(tokens)` 原子累加
    - `checkLimit()` 超过 80% 触发警告,达到上限抛 `E_BUDGET_EXCEEDED`
    - `end()` 标记 session 结束
  - 在每个 Agent 调用 LLM 后自动 `session.recordUsage(metrics.tokens)`
  - _Requirements: 22, 28, 17.5, 17.6_

### 收尾

- [ ] 29. 端到端测试
  - 创建 `tests/e2e/full-chapter-generation.spec.ts` (Playwright)
  - 测试场景: 新建项目 → 手动创建 L1 角色 + 世界观规则 → 点"生成下一章" → 验证 Writer→Critic→Continuity 完整流程 → 章节出现在项目树
  - _Requirements: 1, 4, 5, 6_

- [ ] 30. 阶段 1 验收
  - 跑一遍验收: 章节生成成功率 ≥ 70%,平均耗时 ≤ 90s
  - 至少 3 个不同协议蓝图测试 (OpenAI / DeepSeek / NewAPI)
  - 文档更新: 把 `README.md` 的功能列表替换为 v3.0 描述
  - _Requirements: §五 阶段 1 成功标准_

## 阶段 2: AI 率优化 + 长篇记忆

### Memory Agent

- [ ] 31. Memory Agent 基础实现 (L1+L3)
  - 创建 `src/lib/agents/memory/index.ts`
  - 实现 `buildPack(projectId, chapterOrder)`: 返回 L1 (上一章尾段) + L3 (当前快照)
  - 改造 Writer Agent: 接收 `memoryPack` 参数,注入 system prompt
  - _Requirements: 10.1, 10.2, 10.7_

- [ ] 32. L2 章节摘要链
  - 在 `agentTasks` 完成后,Memory 自动生成本章 200 字摘要
  - 写入 `chapter_summaries` 表 (新增)
  - `buildPack` 增加 L2: 近 5 章摘要
  - _Requirements: 10.6_

- [ ] 33. L4 卷级归档
  - 检测项目大纲的"卷"结构,卷完结时自动归档
  - 归档内容: 该卷所有章节摘要 → LLM 压缩成 1000 字精华
  - 写入 `volume_archives` 表 (阶段 3 schema)
  - _Requirements: 10.6_

- [ ] 34. L5 向量召回
  - 调 OpenAI Embedding API (阶段 2 简化,不用本地 ONNX)
  - 写入 `embeddings` 表 (v2.0 已有)
  - 实现 `semanticRecall(query, topK=5)`
  - _Requirements: 10.3_

- [ ] 35. L6 角色关系图 (简化版)
  - 用 entities 表 + chapter_changes 中的 relationChanges 字段构建关系图
  - 每章本地构建,不持久化到独立表
  - _Requirements: 10.2_

- [ ] 36. Memory token 预算管理
  - 实现 `truncatePack(pack, budget)`:
    - 保留全部 L1 + L3
    - L5 召回片段从 5 减到 3
    - L4 归档摘要化
  - 标记 `truncated: true` 元数据
  - _Requirements: 10.4, 10.8_

### Humanizer Agent

- [ ] 37. Humanizer 规则层
  - 创建 `src/lib/agents/humanizer/rules.ts`
  - AI 高频词黑名单 (硬编码: 然而/此外/总的来说/...)
  - 句式扰动规则 (长句拆短/标点替换)
  - 内心戏注入 (检测段落空白处插入)
  - _Requirements: 9.2_

- [ ] 38. Humanizer AI 重写层
  - 用作者风格指纹 (从 `author_styles` 表读取) 调 LLM 重写关键段落
  - 关键段落: 段首 / 段尾 / 长段中部
  - _Requirements: 9.3_

- [ ] 39. Humanizer 检测层
  - 集成云端 GPTZero API (用户在设置里配)
  - 实现 `detectAIScore(text)` 返回 0-1 分数
  - 失败时降级到不检测,直接通过
  - _Requirements: 9.4_

- [ ] 40. Humanizer 主循环
  - 创建 `src/lib/agents/humanizer/index.ts`
  - 实现 `run()`: 规则层 → AI 重写 → 检测,递归到 ≤30% 或 5 轮
  - 发布 `HUMANIZED_READY` 事件携带最终文本和 AI 率分数
  - _Requirements: 9.1, 9.5, 9.6, 9.7_

### Anchor Agent

- [ ] 41. Anchor 数据模型
  - `entities` 表 `anchor` 字段定义 TypeScript 类型
  - 实现 `loadAnchorsForChapter(projectId, chapterCharacters)`,返回涉及角色的 Anchor
  - 跳过 L3 角色
  - _Requirements: 11.1, 11.2_

- [ ] 42. Anchor 注入到 Writer
  - 改造 Writer 的 `buildSystemPrompt`: 把 Anchor 指纹格式化为 prompt 片段
  - 例如: "张三说话的方式: 多用'罢了'、'区区'。性格: 谨慎、不主动示好。"
  - _Requirements: 11.3_

- [ ] 43. Anchor 校验
  - 创建 `src/lib/agents/anchor/index.ts`
  - 实现 `validate(body, anchors)`:
    - L1 角色: 检查 vocabulary_signature 命中 (regex match)
    - L1+L2 角色: 检查 anti_traits 不被违反 (用 LLM 二次校验)
  - L1 vocab 未命中 → 通过 Director 触发 Writer 局部重写
  - L1 anti_trait 违反 → 触发 Writer 整章重写
  - L2 anti_trait 违反 → 仅警告
  - _Requirements: 11.4, 11.5, 11.6, 11.7_

### 阶段 2 收尾

- [ ] 44. 阶段 2 流水线集成
  - 把 Humanizer 插入主流水线: Writer → Humanizer → Critic
  - 把 Anchor 集成到 Writer 装饰器位置
  - 把 Memory 集成到所有 Agent 的输入构建过程
  - _Requirements: 1.1 (D1)_

- [ ] 45. 阶段 2 验收
  - AI 率 ≤ 30% (本地+云端检测平均)
  - 角色性格一致性人工抽查 ≥ 90%
  - _Requirements: §五 阶段 2 成功标准_

## 阶段 3: 设计期 Agent + 时间线 + ONNX

### 设计期 Agent

- [ ] 46. WorldBuilder Agent
- [ ] 47. Character Agent
- [ ] 48. Outliner Agent
- [ ] 49. ChapterPlanner Agent (替换 MVP 的静态模板)
- [ ] 50. 创世流水线 UI

### Timekeeper Agent

- [ ] 51. Timekeeper 实现
- [ ] 52. timeline 表与查询
- [ ] 53. 倒计时管理 UI

### ONNX 本地化

- [ ] 54. 集成 onnxruntime-web
- [ ] 55. 替换 Embedding 为本地模型
- [ ] 56. 替换 AI 检测为本地模型

### 知识图谱

- [ ] 57. 关系图可视化 (cytoscape)

### 阶段 3 验收

- [ ] 58. 200 章压力测试,设定漂移率 ≤ 5%
