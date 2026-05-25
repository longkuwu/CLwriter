# CLwriter v2.0 架构设计 — 状态驱动模式

> 灵感来源: 天命 (zy-zmc/tianming-novel-ai-writer) 的"反 LLM 上下文窗口"哲学
> 核心思想: AI 不依赖上下文记忆,依靠每章状态回写实现千章连贯

---

## 一、设计哲学

### 旧版 (v1.0) 的问题
- 依赖 LLM 上下文窗口 → 上下文超长会遗忘
- RAG 是相关性检索 → 没有伏笔/誓约状态追踪
- 生成后才校验 → 错误已落地,污染后续章节
- 上下文组装简单 → AI 看到的数据不精准

### 新版 (v2.0) 的核心改造
**写作 = 数据生成 + 数据校验 + 数据回写**

```
读取数据包(Pack) → AI生成正文+CHANGES → 6道门禁(Gate) → 通过则落地+回写状态(Write Back)
                                          ↓
                                      不通过则打回重写
```

---

## 二、五大核心引擎

### 1. CHANGES 协议引擎 (`src/lib/engine/changes/`)

强制 AI 在正文后输出结构化变更声明:

```
正文内容...

---CHANGES---
{
  "characterStateChanges": [...],   // 角色状态变化
  "conflictProgress": [...],         // 冲突进度
  "newPlotNodes": [...],             // 新剧情节点
  "foreshadowActions": [...],        // 伏笔动作 (埋设/回收)
  "locationStateChanges": [...],     // 地点状态变化
  "factionStateChanges": [...],      // 势力状态变化
  "timeAdvance": {...},              // 时间推进
  "characterMovements": [...],       // 角色移动
  "itemTransfers": [...],            // 物品流转
  "secretReveals": [...],            // 秘密揭示
  "oathChanges": [...],              // 誓约约束变化
  "deadlineChanges": [...]           // 截止约束变化
}
```

### 2. 15 维事实快照 (`src/lib/engine/snapshot/`)

每章生成后自动更新的 15 个维度:

| 维度 | 字段 | 示例 |
|------|------|------|
| 1. 角色状态 | characterStates | 张三·筑基期·会御剑术 |
| 2. 角色位置 | characterLocations | 张三→烈焰谷 |
| 3. 角色外貌 | characterAppearances | 黑发金瞳·冷淡 |
| 4. 冲突进度 | conflictProgress | 正邪大战·进行中 |
| 5. 伏笔状态 | foreshadows | 假死真相·已埋·Tier-1 |
| 6. 剧情节点 | plotNodes | 第87章·张三叛出宗门 |
| 7. 地点状态 | locationStates | 烈焰谷·已被封印 |
| 8. 势力状态 | factionStates | 天剑宗·内乱中 |
| 9. 时间线 | timeline | 第N章·三日后 |
| 10. 物品状态 | itemStates | 天命剑·张三持有 |
| 11. 世界观硬约束 | worldConstraints | 凡人不可飞行 |
| 12. 地点特征 | locationFeatures | 烈焰谷·岩浆遍布 |
| 13. 秘密状态 | secretStates | 假死真相·知情人:无 |
| 14. 誓约约束 | oathStates | 与魔教不两立 |
| 15. 截止约束 | deadlineStates | 七日后大劫·倒计时 |

### 3. 6 道生成门禁 (`src/lib/engine/gates/`)

```typescript
Gate 1: 协议解析    // 必须包含 ---CHANGES--- 分隔符 + 合法 JSON
Gate 2: 引用校验    // CHANGES 引用的角色/地点 ID 必须存在
Gate 3: 一致性校验  // 不能与事实快照矛盾
Gate 4: 未知实体    // 新引入实体超阈值打回
Gate 5: 描写一致性  // 角色外貌/地点描写不能与档案冲突
Gate 6: 蓝图出场    // 蓝图指定的角色必须实际出现
```

不通过 = 章节不落地,AI 重写。

### 4. 数据中心打包器 (`src/lib/engine/pack/`)

每章生成前组装 12 类数据包:

```typescript
ChapterPack {
  fiveRules: { worldview, characters, factions, locations, plotRules },
  outlineSlice: 当前卷结构,
  chapterPlan: 本章蓝图,
  templates: 题材提示词,
  factSnapshot: 截止上一章的 15 维快照,
  summaryChain: 前 N 章递进式摘要,
  prevTail: 上一章结尾原文,
  milestones: 跨卷关键事件,
  vectorRecall: 语义召回片段,
  prevVolumeFacts: 前卷归档,
  driftWarnings: 状态偏离警告,
  sceneGuide: 场景执行引导
}
```

AI **只看本章相关数据**,而不是塞整本书进上下文。

### 5. 统一校验系统 (`src/lib/engine/validator/`)

改了设定 → 全书扫描 → 精确列出受影响章节号:

```
张三能力规则: "畏火" → 修改为 "克火"
↓
统一校验扫描所有章节 CHANGES
↓
冲突章节: 第 45、87、123、201 章
```

---

## 三、数据库 Schema 扩展

### 新增表

```sql
-- 事实快照表 (核心)
fact_snapshots {
  id, projectId, chapterId, chapterOrder,
  characterStates,      -- JSON
  characterLocations,   -- JSON
  characterAppearances, -- JSON
  conflictProgress,     -- JSON
  foreshadows,          -- JSON (含 status: setup/payoff/expired, tier)
  plotNodes,            -- JSON
  locationStates,       -- JSON
  factionStates,        -- JSON
  timeline,             -- JSON
  itemStates,           -- JSON
  worldConstraints,     -- JSON
  locationFeatures,     -- JSON
  secretStates,         -- JSON
  oathStates,           -- JSON
  deadlineStates,       -- JSON
  createdAt
}

-- 章节变更声明表
chapter_changes {
  id, projectId, chapterId, chapterOrder,
  rawChanges,    -- 原始 JSON
  parsedAt,
  gateResults,   -- 6 道门禁结果
  status         -- pending/passed/rejected/applied
}

-- 实体表 (角色/地点/势力等的设定档案)
entities {
  id, projectId, type, name, archetype,
  attributes,    -- JSON 属性
  rules,         -- JSON 规则约束
  status         -- active/archived
}

-- 伏笔表 (独立追踪)
foreshadows {
  id, projectId, name, description,
  tier,          -- 1/2/3
  setupChapter,  -- 埋设章节
  payoffChapter, -- 回收章节 (NULL=未收)
  status,        -- setup/payoff/expired
  relatedEntities -- JSON
}

-- 门禁日志表
gate_logs {
  id, projectId, chapterId,
  gateName,      -- gate1/gate2/.../gate6
  passed,        -- boolean
  errors,        -- JSON
  triggeredAt
}

-- 历史里程碑表
milestones {
  id, projectId, chapterOrder,
  title, summary,
  importance     -- 1-10
}
```

---

## 四、目录结构

```
src/lib/engine/
├── changes/              # CHANGES 协议
│   ├── types.ts          # 12 类变更声明的类型定义
│   ├── parser.ts         # 解析 ---CHANGES--- 分隔符
│   ├── prompt.ts         # 注入 AI 的协议提示词
│   └── applier.ts        # 应用变更到事实快照
├── snapshot/             # 15 维事实快照
│   ├── types.ts          # 快照类型定义
│   ├── manager.ts        # 快照读写管理
│   ├── differ.ts         # 快照差异计算
│   └── projector.ts      # 从 CHANGES 投影到快照
├── gates/                # 6 道生成门禁
│   ├── gate1-protocol.ts
│   ├── gate2-reference.ts
│   ├── gate3-consistency.ts
│   ├── gate4-unknown.ts
│   ├── gate5-description.ts
│   ├── gate6-blueprint.ts
│   └── orchestrator.ts   # 门禁编排
├── pack/                 # 数据中心打包器
│   ├── types.ts          # ChapterPack 定义
│   ├── packager.ts       # 打包主逻辑
│   ├── recall.ts         # 长距召回
│   └── drift.ts          # 状态偏离检测
├── validator/            # 统一校验
│   ├── full-validate.ts  # 全书校验
│   ├── reconciler.ts     # 一致性调和
│   └── impact.ts         # 影响分析
└── prompts/              # 协议级提示词
    ├── system.ts         # 系统级 prompt
    └── chapter.ts        # 章节生成 prompt
```

---

## 五、迁移路线

### Phase 1: 引擎骨架 (本次)
- ✅ 类型定义
- ✅ 数据库 Schema 扩展
- ✅ CHANGES 协议 (parser + types + prompt)
- ✅ 事实快照系统 (manager + projector)
- ✅ 6 道生成门禁 (基础版)
- ✅ 数据中心打包器 (基础版)

### Phase 2: 集成现有功能
- 修复现有 build 错误
- 把章节生成流程接入新引擎
- 兼容 epic/viral 双引擎

### Phase 3: UI 重构
- 事实快照可视化面板
- 伏笔追踪面板
- 门禁日志面板
- 统一校验工具

### Phase 4: 高级特性
- 长距召回向量化
- 一致性调和器
- 仿人化选词

---

**核心信条**: 千章连贯不是靠模型记忆,而是靠每章状态回写。
