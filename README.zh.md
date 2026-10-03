<p align="center">
  <strong>English</strong> | <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português</a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/mcp-tool-shop-org/brand/main/logos/LoKey-Typer/readme.png" alt="LoKey Typer" width="400" />
</p>

<p align="center">
  <a href="https://github.com/mcp-tool-shop-org/lokey-typer/actions/workflows/deploy.yml"><img src="https://github.com/mcp-tool-shop-org/lokey-typer/actions/workflows/deploy.yml/badge.svg" alt="Deploy"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License"></a>
  <a href="https://mcp-tool-shop-org.github.io/lokey-typer/"><img src="https://img.shields.io/badge/Pages-target-blue" alt="Pages target"></a>
  <a href="https://apps.microsoft.com/detail/9NRVWM08HQC4"><img src="https://img.shields.io/badge/Microsoft_Store-available-blue" alt="Microsoft Store"></a>
</p>

一款安静的打字练习应用，提供环境音效，可定制每日练习内容，且无需注册账号。

## 它是什么

LoKey Typer是一款专为希望在安静、专注的环境中进行打字练习的成年人设计的应用程序。它不包含游戏化元素、排行榜或其他可能分散注意力的功能。

所有数据都存储在您的设备上。无需注册账号，无需云存储，也无任何追踪。

## 练习模式

- **重点**：精心设计的练习，旨在提高节奏感和准确性。
- **真实场景**：通过电子邮件、代码片段和日常文本进行练习。
- **竞技模式**：限时练习，并记录个人最佳成绩。
- **每日练习**：每天生成一套新的练习内容，并根据您最近的练习情况进行调整。

## 功能特点

- 专为保持专注而设计的环境音景（42个音轨，非节奏型）。
- 机械打字机按键声音（可选）。
- 基于最近的训练记录，提供个性化的每日练习。
- 首次加载后可完全离线使用。
- 易于访问：支持屏幕阅读器模式、减少动画效果，以及可选择关闭声音。

## 安装

**Microsoft 商店**（推荐）：
[从 Microsoft 商店获取](https://apps.microsoft.com/detail/9NRVWM08HQC4)

**浏览器：**
运行 `npm run dev` 并打开本地地址。[Pages 目标地址](https://mcp-tool-shop-org.github.io/lokey-typer/) 是本仓库公开之后，工作流发布应用的位置。手册在同一站点的 `/handbook/`。在此之前，该地址不是可用的应用。

## 隐私

LoKey Typer 不会收集任何数据。所有偏好设置、运行历史以及个人最佳记录都存储在您的本地浏览器中。请参阅完整的[隐私政策](https://mcp-tool-shop-org.github.io/lokey-typer/privacy.html)。该页面会随站点一起发布。在本仓库公开之前，该地址不是可用页面。

## 许可

麻省理工学院。请参考 [LICENSE](LICENSE) 文件。

---

## 发展

### 本地运行

```bash
npm ci
npm run dev
```

### 构建

```bash
npm run build
npm run preview
```

### 剧本

- `npm run dev` — 开发服务器
- `npm run build` — 类型检查 + 生产环境构建
- `npm run typecheck` — 仅进行 TypeScript 类型检查
- `npm run lint` — ESLint 代码检查
- `npm run preview` — 本地预览生产环境构建
- `npm run validate:content` — 对所有内容包进行模式和结构验证
- `npm run gen:phase2-content` — 重新生成第二阶段内容包
- `npm run smoke:rotation` — 新颖内容/轮播测试
- `npm run qa:ambient:assets` — 检查环境音效文件
- `npm run qa:sound-design` — 声音设计验收环节
- `npm run qa:phase3:novelty` — 每日新内容模拟
- `npm run qa:phase3:recommendation` — 推荐系统可靠性模拟

### 代码结构

- `src/app`：应用程序的结构和配置（路由、主布局、全局服务提供者）。
- `src/features`：特定功能的UI界面（页面 + 功能组件）。
- `src/lib`：共享的领域逻辑（存储、类型定义、指标、音频/环境等）。
- `src/content`：内容类型 + 内容包加载。

请参考 `modular.md` 文件，了解模块化设计的架构规范和模块导入的边界。

### 导入别名

- `@app` → `src/app`
- `@features` → `src/features`
- `@content` → `src/content`
- `@lib` → `src/lib/public` (公共API接口)
- `@lib-internal` → `src/lib` (仅限于应用程序的配置/提供者)

### 路线

- `/` — 首页
- `/daily` — 每日推荐
- `/focus` — 专注模式
- `/real-life` — 真实场景模式
- `/competitive` — 竞技模式
- `/<mode>/exercises` — 练习列表
- `/<mode>/settings` — 设置
- `/<mode>/run/:exerciseId` — 运行练习 (exerciseId 为练习的 ID)

### 文档

- `modular.md` — 架构 + 模块化接口规范
- `docs/sound-design.md` — 声音设计框架
- `docs/sound-design-manifesto.md` — 声音设计宣言 + 验收测试
- `docs/sound-philosophy.md` — 面向公众的声音设计理念
- `docs/accessibility-commitment.md` — 可访问性承诺
- `docs/how-personalization-works.md` — 个性化功能原理说明
