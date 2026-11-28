# dsh-plugin-study

面向 **DeepSeek Harness (`@deepseek-ai/dsh`)** 的理工及专业技术通用伴学插件。将“流内轻量定性探针 + 沉静现代讲义推演 + 受控 Matplotlib/SVG 矢量配图 + 右侧栏伴学脉络抽屉”打包为开箱即用的 Cordis 插件。

## 核心能力

1. **显式零污染双技能（`study` + `study-feedback`）**：
   - 日常编程与常规问答完全隐身（`modelInvocable: false`），仅当用户输入 `/study` 或 `/study-feedback` 时触发；
   - 靶向直答零额外文件读取首轮一屏答清；分卡伴学按“首轮一站式确认深度档位与首卡关键探针 $\rightarrow$ 定稿蓝图并同步右侧抽屉、同轮开讲首卡 $\rightarrow$ 沉静现代讲义推演、按需小例与矢量配图 $\rightarrow$ 确认继续默认归档推进”运行。
2. **三项受控工具接管真按需外挂、沙箱绘图与抽屉同步**：
   - `study_read_workflow`：按需加载 `long-corpus`（百页长卷总图）、`plotting`（对口科学图型选型、原件图示搬运与绘图施工）与 `archiving`（自然讲义落盘与双模板）三份重动作外挂规程；常规靶向直答与纯文字推演无需额外读取；
   - `study_render_plot`：在隔离临时沙箱调用内置 `plot_helper.py`（经 `uv run`，支持曲线/热力图/几何矢量、含复杂公式的结构框图、文字转曲、`<= 4` 主色与防撞体检）或清洗纯文字/简单符号圆角 `<svg>` 并自动经 `check_svg.py` 体检，导出精简 `.svg` 返回标准 Markdown `![图注](路径)` 原位渲染；
   - `study_sync_blueprint`：实时同步会话蓝图与进度（支持 `卡 02_0.1` 先修卡与 `卡 01.1` 子卡编号），并顺带执行磁盘配图实存（兼容 `.svg / .png / .jpg / .webp`）与缩进公式等排版硬伤自检。
3. **Web UI 右侧栏「伴学脉络」抽屉（`./client`）**：
   - 实时同步当前会话蓝图（支持自定义工作区相对笔记目录 `notesDir`）并自动扫描 `./学习伴学/*/00_伴学脉络蓝图.md` 与 `./学习笔记/*/00_伴学脉络蓝图.md`；
   - 支持卡片进度追踪、快捷复制“继续 / 先落盘 / 跳过存盘，继续”指令、自然讲义归档卡分段与 `.svg` / 搬运位图原图同屏安全预览及深浅色主题自适应；在 TUI / Headless 模式下自动优雅降级。
4. **轻量更新感知（零 LLM Token、不打断伴学）**：
   - 插件后端在初始化后异步检查新版（`24` 小时成功缓存 / `6` 小时失败负缓存，经 GitHub Releases 重定向头探测并回退 npm `dist-tags`），绝不阻塞宿主启动；
   - 发现严格新版时，仅在右侧栏抽屉顶部展示一行主题自适应提示横幅（附 Release 说明链接与“7 天内不提醒”按钮），不自动覆盖本地安装；可设环境变量 `DSH_STUDY_NO_UPDATE_CHECK=1` 或 `NO_UPDATE_NOTIFIER=1` 禁用（`CI` 环境默认关闭）。

## 环境要求

- DeepSeek Harness（`@deepseek-ai/dsh`）Web / Desktop / TUI 运行时；
- Node.js `>= 20.12.0`；
- [uv](https://docs.astral.sh/uv/)（用于按需隔离运行 `plot_helper.py` 科学绘图环境）。

## 安装与升级

### 方式一：通过 DSH Discover 市场源安装（支持原生 Git commit 更新感知）

在 DeepSeek Harness Web UI 插件市场的自定义索引（Discover）中添加以下 Format 1 市场源 URL 并安装 `dsh-plugin-study`：

```text
https://crrisugi.github.io/dsh-plugin-study/index.json
```

后续新版本发布时，DSH 插件管理页会原生标出 **Update available** 并支持界面内升级。

### 方式二：通过 npm 包安装（支持原生 Registry 刷新与回滚升级）

```bash
dsh plugin --profile web add dsh-plugin-study
```

通过 npm 安装后，可在 DSH 插件管理页点击 **Refresh** 与 **Update** 原生升级。

### 方式三：本地源码开发安装（仅限开发调试）

```bash
git clone https://github.com/crrisugi/dsh-plugin-study.git
cd dsh-plugin-study
pnpm install && pnpm run build
dsh plugin --profile web add ./
```

> 本地 `./` 路径安装的插件在 DSH 中标记为 `not-updatable`，仅适合源码调试；升级需在克隆仓库执行 `git pull --ff-only && pnpm run build`。

启动 `dsh web` 后：
- 在对话框输入 `/study` 并附上公式截图、论文段落或源码，即可开始伴学；
- 点击右侧栏「**伴学脉络**」标签页即可实时查看卡片路线、前置状态与归档进度；
- 需要记录伴学现场反馈时输入 `/study-feedback` 生成四要素记录单，并可选择通过 `gh` 一键提交 Issue 或匿名推送反馈。

## 本地构建、校验与市场索引

```bash
pnpm install
pnpm run verify
# 导出符合 DSH Format 1 规范的 Discover 市场索引 JSON
pnpm run market:index
```

## 开源许可

[MIT License](LICENSE)
