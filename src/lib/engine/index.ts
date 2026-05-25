/**
 * 引擎主入口
 *
 * 统一暴露所有引擎能力
 */

// CHANGES 协议
export * from './changes/types'
export { parseOutput, summarizeChanges } from './changes/parser'
export { CHANGES_PROTOCOL_PROMPT, injectChangesProtocol } from './changes/prompt'

// 事实快照
export * from './snapshot/types'
export { projectSnapshot } from './snapshot/projector'
export { getLatestSnapshot, getSnapshotAt, saveSnapshot, ensureSnapshot } from './snapshot/manager'

// 6 道门禁
export * from './gates/types'
export { runAllGates, buildGateFeedback } from './gates/orchestrator'

// 数据中心打包
export * from './pack/types'
export { packChapter } from './pack/packager'

// 章节 Prompt 构建
export { buildChapterSystemPrompt } from './prompts/chapter'

// 主流程
export { generateChapterWithEngine } from './generate'
