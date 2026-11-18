# dsh-plugin-study

面向 **DeepSeek Harness (`@deepseek-ai/dsh`)** 的理工及专业技术通用伴学插件。将“流内诊断探针 + 10 类正交草稿纸最小算例推演 + 受控 Matplotlib/SVG 矢量配图 + 右侧栏伴学脉络抽屉”打包为开箱即用的 Cordis 插件。

## 核心能力

1. **显式零污染双技能（`study` + `study-feedback`）**：
   - 日常编程与常规问答完全隐身（`modelInvocable: false`），仅当用户输入 `/study` 或 `/study-feedback` 时触发；
   - 靶向直答一屏算例答清，分卡伴学按“首轮选定深度档位 $\rightarrow$ 按需摸底与先修分流（原生 `ask_user_question` 点选卡片） $\rightarrow$ 排定蓝图与底座算例 $\rightarrow$ 草稿纸推演配图 $\rightarrow$ 确认归档”推进。
2. **双受控工具接管文件与沙箱绘图**：
   - `study_read_reference`：从插件包内按需读取 10 份正交草稿纸表征规范，保持工具 Schema 静态不变以维持 DeepSeek KV Cache 命中率；
   - `study_render_plot`：在隔离临时沙箱调用内置 `plot_helper.py`（经 `uv run`）或清洗手写圆角 `<svg>`，导出瘦身 `.svg` 并返回标准 Markdown `![图注](路径)` 原位渲染（免除终端审批弹窗）。
3. **Web UI 右侧栏「伴学脉络」抽屉（`./client`）**：
   - 实时同步当前会话蓝图（由 `study_sync_blueprint` 推送，支持自定义工作区相对笔记目录 `notesDir` 并顺带执行磁盘断链自检）与自动扫描 `./学习笔记/*/00_伴学脉络蓝图.md`；
   - 支持卡片进度追踪、快捷复制“落盘/继续”口令、归档卡分段与 `.svg` 图文同屏安全预览及深浅色主题自适应；在 TUI / Headless 模式下自动优雅降级，不影响主插件加载。

## 环境要求

- DeepSeek Harness（`@deepseek-ai/dsh`）Web / Desktop / TUI 运行时；
- Node.js `>= 20.12.0`；
- [uv](https://docs.astral.sh/uv/)（用于按需隔离运行 `plot_helper.py` 科学绘图环境）。

## 安装与使用

```bash
git clone https://github.com/crrisugi/dsh-plugin-study.git
cd dsh-plugin-study
pnpm install && pnpm run build
dsh plugin --profile web add ./
```

启动 `dsh web` 后：
- 在对话框输入 `/study` 并附上公式截图、论文段落或源码，即可开始伴学；
- 点击右侧栏「**伴学脉络**」标签页即可实时查看卡片路线、统一算例与进度；
- 需要记录伴学失真反馈时输入 `/study-feedback` 生成脱敏诊断单。

## 本地构建、校验与市场索引

```bash
pnpm install
pnpm run verify
# 导出符合 DSH Format 1 规范的 Discover 市场索引 JSON
pnpm run market:index
```

## 开源许可

[MIT License](LICENSE)
