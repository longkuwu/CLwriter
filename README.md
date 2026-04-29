# CLwriter - AI 驱动的智能小说创作平台

<div align="center">

![CLwriter Banner](https://img.shields.io/badge/CLwriter-AI%20Novel%20Writing-blue?style=for-the-badge)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-orange?style=flat-square&logo=tauri)](https://tauri.app/)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)

**一个功能强大的 AI 辅助小说创作工具，支持双引擎创作模式、智能记忆系统和实时写作反馈**

[功能特性](#-功能特性) • [快速开始](#-快速开始) • [技术栈](#-技术栈) • [项目结构](#-项目结构) • [使用指南](#-使用指南)

</div>

---

## ✨ 功能特性

### 🎯 双引擎创作模式

- **🏰 宏大叙事引擎 (Epic Engine)**
  - 适合传统长篇小说创作
  - 注重世界观构建和人物深度
  - 提供完整的设定管理系统

- **🔥 流量爆款引擎 (Viral Engine)**
  - 针对网文爆款优化
  - 强调节奏控制和爽点设计
  - 实时流量潜力分析

### 🤖 智能 AI 助手矩阵

| AI Agent | 功能描述 |
|---------|---------|
| **章节生成器** | 基于大纲和设定自动生成章节内容 |
| **节奏监控器** | 实时分析文本节奏，提供优化建议 |
| **解构分析器** | 深度分析文本结构和叙事技巧 |
| **风格模仿器** | 学习并模仿特定作者的写作风格 |
| **逻辑守卫** | 检测情节逻辑漏洞和设定冲突 |
| **状态追踪器** | 自动追踪人物状态和世界观变化 |
| **读者沙盒** | 模拟读者反应，预测阅读体验 |

### 📚 RAG 记忆系统

- **向量嵌入存储**: 自动将设定、人物、情节转换为向量
- **语义搜索**: 智能检索相关背景信息
- **滚动摘要**: 防止 AI 遗忘前文内容
- **Codex 记忆库**: 持久化存储关键信息

### 🎨 风格胶囊系统

预置多种写作风格模板：
- 玄幻经典风格
- 知乎复仇文风格
- 自定义风格配置

### 💾 本地优先架构

- 使用 PGlite 实现完全本地化数据存储
- 无需服务器，数据完全掌控
- 支持导出为 DOCX、Markdown 等格式

### 🖥️ 跨平台支持

- **Web 应用**: 在浏览器中直接使用
- **桌面应用**: 通过 Tauri 打包为原生应用
  - Windows
  - macOS
  - Linux

---

## 🚀 快速开始

### 前置要求

- Node.js 18+ 
- npm / yarn / pnpm
- (可选) Rust 1.70+ - 用于构建桌面应用

### 安装步骤

1. **克隆仓库**

```bash
git clone https://github.com/longkuwu/CLwriter.git
cd CLwriter
```

2. **安装依赖**

```bash
npm install
# 或
yarn install
# 或
pnpm install
```

3. **配置环境变量**

创建 `.env.local` 文件：

```env
# OpenAI API 配置
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_BASE_URL=https://api.openai.com/v1  # 可选，使用自定义端点

# 数据库配置（PGlite 本地存储，无需额外配置）
```

4. **启动开发服务器**

```bash
# Web 开发模式
npm run dev

# 桌面应用开发模式
npm run dev:desktop
```

5. **访问应用**

打开浏览器访问 [http://localhost:3000](http://localhost:3000)

---

## 🛠️ 技术栈

### 前端框架
- **Next.js 14** - React 全栈框架
- **React 18** - UI 库
- **TypeScript** - 类型安全

### 桌面应用
- **Tauri 2.x** - 轻量级桌面应用框架
- **Rust** - 系统级性能

### 数据库
- **PGlite** - 本地 PostgreSQL 数据库
- **Drizzle ORM** - 类型安全的 ORM

### AI 集成
- **Vercel AI SDK** - AI 应用开发框架
- **OpenAI API** - GPT 模型支持

### 编辑器
- **Tiptap** - 富文本编辑器
- **ProseMirror** - 编辑器核心

### UI 组件
- **Radix UI** - 无障碍组件库
- **Tailwind CSS** - 原子化 CSS
- **Lucide Icons** - 图标库

### 状态管理
- **Zustand** - 轻量级状态管理

---

## 📁 项目结构

```
CLwriter/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── page.tsx             # 书架首页
│   │   └── editor/[projectId]/  # 编辑器页面
│   ├── components/
│   │   ├── editor/              # 编辑器组件
│   │   │   ├── TiptapEditor.tsx
│   │   │   ├── ChapterLauncher.tsx
│   │   │   ├── RhythmMonitor.tsx
│   │   │   ├── ViralFlow.tsx
│   │   │   └── ...
│   │   ├── sidebar/             # 侧边栏组件
│   │   │   ├── ViralSidebar.tsx
│   │   │   ├── WorldStatePanel.tsx
│   │   │   └── DeconstructPanel.tsx
│   │   ├── dashboard/           # 仪表盘组件
│   │   └── ui/                  # 基础 UI 组件
│   └── lib/
│       ├── ai/                  # AI Agent 集合
│       │   ├── chapter-agent.ts
│       │   ├── rhythm-agent.ts
│       │   ├── viral-agent.ts
│       │   ├── writer-agent.ts
│       │   └── ...
│       ├── db/                  # 数据库
│       │   ├── index.ts
│       │   └── schema.ts
│       ├── actions/             # Server Actions
│       ├── store/               # Zustand Store
│       └── utils/               # 工具函数
├── src-tauri/                   # Tauri 桌面应用
│   ├── src/
│   │   ├── main.rs
│   │   └── lib.rs
│   └── Cargo.toml
├── public/
│   └── plugins/
│       └── capsules/            # 风格胶囊配置
└── drizzle/                     # 数据库迁移文件
```

---

## 📖 使用指南

### 1. 创建新项目

1. 在书架页面点击「新建作品」
2. 输入书名
3. 选择创作引擎：
   - 🏰 宏大叙事 - 适合传统长篇
   - 🔥 流量爆款 - 适合网文快节奏

### 2. 编辑器界面

编辑器采用三栏布局：

- **左侧栏**: 资源树管理
  - 章节管理
  - 设定文档
  - 人物卡片
  - 世界观设定

- **中间栏**: 沉浸式编辑器
  - Markdown 富文本编辑
  - 实时自动保存
  - 快捷键支持

- **右侧栏**: AI 助手面板
  - 世界状态追踪
  - 逻辑检查
  - 节奏分析
  - 实体建议

### 3. 使用 AI 助手

#### 章节生成
1. 在左侧创建新章节
2. 点击「章节启动器」
3. 输入章节大纲或关键情节
4. AI 自动生成初稿

#### 节奏监控
- 编辑器右侧实时显示节奏曲线
- 绿色：节奏流畅
- 黄色：需要调整
- 红色：节奏问题

#### 风格模仿
1. 打开「风格工作室」
2. 上传参考文本或选择预设风格
3. AI 学习并应用该风格

### 4. 导出作品

支持多种导出格式：
- **DOCX** - Microsoft Word 格式
- **Markdown** - 纯文本格式
- **TXT** - 纯文本格式

---

## 🔧 开发指南

### 构建桌面应用

```bash
# 开发模式
npm run dev:desktop

# 构建生产版本
npm run build:desktop
```

构建产物位于 `src-tauri/target/release/`

### 数据库迁移

```bash
# 生成迁移文件
npx drizzle-kit generate

# 应用迁移
npx drizzle-kit push
```

### 添加新的 AI Agent

1. 在 `src/lib/ai/` 创建新的 agent 文件
2. 实现 agent 逻辑
3. 在相应组件中调用

示例：

```typescript
// src/lib/ai/my-agent.ts
import { generateText } from 'ai'
import { getAIClient } from '@/lib/ai-client'

export async function myAgent(input: string) {
  const model = getAIClient()
  
  const { text } = await generateText({
    model,
    prompt: `你的提示词: ${input}`,
  })
  
  return text
}
```

---

## 🤝 贡献指南

欢迎贡献代码、报告问题或提出建议！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

---

## 📝 开发路线图

- [ ] 支持更多 AI 模型（Claude、Gemini 等）
- [ ] 多人协作功能
- [ ] 云端同步（可选）
- [ ] 移动端适配
- [ ] 插件系统
- [ ] 更多导出格式（EPUB、PDF）
- [ ] 语音输入支持
- [ ] 多语言支持

---

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

---

## 🙏 致谢

- [Next.js](https://nextjs.org/) - 强大的 React 框架
- [Tauri](https://tauri.app/) - 轻量级桌面应用框架
- [Vercel AI SDK](https://sdk.vercel.ai/) - AI 应用开发工具
- [Tiptap](https://tiptap.dev/) - 现代化编辑器
- [Drizzle ORM](https://orm.drizzle.team/) - 类型安全的 ORM

---

## 📧 联系方式

- GitHub: [@longkuwu](https://github.com/longkuwu)
- 项目地址: [https://github.com/longkuwu/CLwriter](https://github.com/longkuwu/CLwriter)

---

<div align="center">

**如果这个项目对你有帮助，请给个 ⭐️ Star 支持一下！**

Made with ❤️ by longkuwu

</div>
