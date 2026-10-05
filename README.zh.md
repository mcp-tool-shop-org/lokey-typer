<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.md">English</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
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

一款具有环境音效、个性化每日练习和无需账户的平静打字练习应用程序。

## 它是什么

LoKey Typer 是一款打字练习应用程序，专为希望进行安静、专注的练习而无需游戏化、排行榜或干扰的成年人设计。

所有数据都保存在您的设备上。无需账户。无需云服务。无需跟踪。

## 练习模式

- **专注**——平静、精选的练习，旨在培养节奏感和准确性。
- **实际应用**——使用电子邮件、表格、消息、笔记和其他日常写作进行练习。
- **竞赛**——限时冲刺，挑战个人最佳成绩。
- **每日练习**——每天生成一组新的练习，并根据您最近的练习进行调整。
- **学习**——添加您自己的文本。文本将保存在此设备上，并以顺序或随机顺序逐个显示。

## 功能

- 专为持续专注而设计的环境音效。设置列表中仅显示包含音轨的类别。
- 机械打字机按键音（可选），以及“咔哒”、“嘀嗒”和“静音”选项。您选择的键盘将应用于该录音。默认设置为机械键盘。
- 基于最近练习的个性化每日练习。
- 首次加载后可完全离线使用。
- 易于访问：屏幕阅读器模式、减少动画、可选声音。

## 安装

**Microsoft Store（推荐）：**
[从 Microsoft Store 获取](https://apps.microsoft.com/detail/9NRVWM08HQC4)

**浏览器：**
运行 `npm run dev` 并打开本地地址。Pages 工作流会在 [Pages 网站](https://mcp-tool-shop-org.github.io/lokey-typer/) 上发布该应用程序。手册在该网站的 `/handbook/` 处提供。

**Docker（自托管）：**

```bash
docker run -d --name lokey-typer -p 8080:8080 --restart unless-stopped ghcr.io/mcp-tool-shop-org/lokey-typer:latest
```

然后打开 `http://localhost:8080/`。手册位于 `/lokey-typer/handbook/`。您的进度将由您的浏览器为该地址保存，而不是保存在容器内，因此停止、升级或替换容器不会影响进度。每次都打开相同的主机和端口；不同的地址将从头开始。

## 隐私

LoKey Typer 不收集任何数据。偏好设置、运行历史记录、个人最佳成绩以及您添加到“学习”中的文本都保存在此浏览器中。请参阅完整的 [隐私政策](https://mcp-tool-shop-org.github.io/lokey-typer/privacy.html)。该页面与网站一起发布。

## 许可

MIT。请参阅 [LICENSE](LICENSE)。

---

## 开发

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

### 脚本

- `npm run dev` — 开发服务器
- `npm run build` — 类型检查 + 生产构建
- `npm run verify` — 内容检查、声音验证、类型检查、覆盖率和生产构建
- `npm run typecheck` — 仅进行 TypeScript 构建和类型检查
- `npm run lint` — ESLint
- `npm run preview` — 在本地预览生产构建
- `npm run validate:content` — 针对所有内容包进行架构 + 结构验证
- `npm run gen:phase2-content` — 重新生成第二阶段包
- `npm run smoke:rotation` — 新颖性/轮换测试
- `npm run qa:ambient:assets` — 环境 WAV 资源检查
- `npm run qa:sound-design` — 声音设计验收验证
- `npm run qa:phase3:novelty` — 每日练习新颖性模拟
- `npm run qa:phase3:recommendation` — 推荐合理性模拟

### 代码结构

- `src/app` — 应用程序连接（路由器、shell/布局、全局提供程序）
- `src/features` — 功能驱动的 UI（页面 + 功能组件）
- `src/lib` — 共享领域逻辑（存储、打字指标、音频/环境等）
- `src/content` — 内容类型 + 内容包加载

请参阅 `modular.md`，了解架构约定和导入边界。

### 导入别名

- `@app` → `src/app`
- `@features` → `src/features`
- `@content` → `src/content`
- `@lib` → `src/lib/public`（公共 API 表面）
- `@lib-internal` → `src/lib`（仅限于应用程序连接/提供程序）

### 路由

- `/` — 主页
- `/daily` — 每日练习
- `/focus` — 专注模式
- `/real-life` — 实际应用模式
- `/competitive` — 竞赛模式
- `/study` — 学习，用于您添加的文本
- `/focus/run/:exerciseId`、`/real-life/run/:exerciseId`、`/competitive/run/:exerciseId` — 运行练习
- `/practice` 重定向到 `/focus`。`/arcade` 重定向到 `/competitive`

设置从标题栏打开。没有练习列表页面。

### 文档

- `modular.md` — 架构 + 导入边界约定
- `docs/sound-design.md` — 环境音效设计框架
- `docs/sound-design-manifesto.md` — 声音设计宣言 + 验收测试
- `docs/sound-philosophy.md` — 面向公众的声音理念
- `docs/accessibility-commitment.md` — 可访问性承诺
- `docs/how-personalization-works.md` — 个性化说明

---

## 安全性和数据范围

LoKey Typer 是一款打字练习 Web 应用程序（PWA + Microsoft Store），没有账户也没有遥测数据。

- **访问的数据：** 浏览器 localStorage（偏好设置、运行历史记录、个人最佳成绩）和 IndexedDB 数据库 `lokey-study`（您在“学习”页面中添加的文本）
- **未访问的数据：** 没有云同步。没有遥测数据。没有分析。没有账户。没有跟踪。
- **网络：** 应用程序从同一来源加载其页面和音频。它不会调用账户服务、遥测端点或任何第三方 API。
- **不收集或发送任何遥测数据**

完整策略：[SECURITY.md](SECURITY.md)

---

## 评分表

| 类别 | 分数 |
|----------|-------|
| A. 安全性 | 10/10 |
| B. 错误处理 | 10/10 |
| C. 操作文档 | 10/10 |
| D. 发布卫生 | 10/10 |
| E. 身份（软性） | 10/10 |
| **Overall** | **50/50** |

---

<p align="center">
  Built by <a href="https://mcp-tool-shop.github.io/">MCP Tool Shop</a>
</p>
