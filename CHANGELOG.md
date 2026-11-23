# Changelog

All notable changes to `dsh-plugin-study` will be documented in this file.

## [0.2.6] - 2026-11-23

### Added
- 新增独立按需读取的伴学讲义语言风格卡 `assets/workflows/teaching-style.md`，并将其纳入 `WORKFLOW_TOPICS` 与 `study_read_workflow`（`4` 份专项规程：确立清朗现代书面讲义腔、零“我们”轻路标与平实现代动作动词、路线式 `##` 小标题与 `1. **短动作标题**：` 多步拆块、真拐点停半拍说透画面、`---` 分割线接 `核心结论/成立前提` 同框、框外零复读 `得失权衡/易混边界` 及 4 组通用正反标尺）。
- 在蓝图模板设立动态 `## 三、已学主线与阶段收获` 账本，同步更新内置 `assets/python/check_notes.py` 支持 `--recap` 主线回看与引用框核心结论兜底解析。
- `src/client/card-preview.tsx` 与 `src/client/styles.ts` 补齐水平分割线 `---` 与 `>` 引用块主题自适应渲染，完美呈现新定稿的结论与前提框。

### Changed
- 全量对齐 `study` 伴学规程至 `v0.2.6`：协同为 `assets/skills/study/SKILL.md` 语感段瘦身并挂接 `study_read_workflow("teaching-style")`；`assets/workflows/archiving.md` 同步升级为路线式小标题、`1. **动作**：` 拆块与分割线结论框骨架；`assets/workflows/plotting.md` 改为趋势图按需打印特征点小表；`10` 份 `assets/references/*.md` 明确定位为按需工具书（无需算例时跳过第 1 节）。
- 算例改按需克制与心算底线：划清必须举小例与禁推完硬代数字验算边界，保留“拆结构简化”；废止蓝图全篇底座算例并更新 `study_sync_blueprint` 兼容描述与侧栏空态文案；明确免摸底开篇一句短话依据、先亮山顶并简对称重复，以及 `k-A` 关键转折预测与卡末易混自核的按需零打字单选（答对自动落盘）。

## [0.2.5] - 2026-11-22

### Added
- 新增按需专项流程读取工具 `study_read_workflow` 与 3 份内置流程细则 `assets/workflows/long-corpus.md`（百页长卷总图与跨单元推进）、`assets/workflows/plotting.md`（原件清晰图示搬运与双类绘图施工）与 `assets/workflows/archiving.md`（自然讲义落盘与骨架示例）。
- 内置纯标准库体检脚本 `assets/python/check_svg.py` 与 `assets/python/check_notes.py`，并在 `study_render_plot` 的手写 SVG 分支自动触发快检返回布局穿字、越界、浅底、主色系与原件式号/章节索引提醒；在 `plotCode` 分支透传脚本 `stdout`（特征点小表）与 `plot_helper` 自检提示。

### Changed
- 全量同步 `study` 伴学主干规程至对齐 `study-skill v0.2.5`：包含独立单轮新符号快筛、4 题摸底扩宽、补钻下位断点硬触发、先修卡统一编号 `目标卡号_0.1 / _0.2`、并列概览与多独立机制拆子卡 `01.1 / 01.2`、讲解与落盘笔记独立可读定位（清零正文/小标题/核心结论/配图原件式号与章节/附录索引，跨卡隔段直写算式）、原件已有清晰图示由直接指认升级为复制/截取/重画搬进对话与 `assets/`，以及废止五块黑括号列表模板、改为沿用对话自然 `##` 小标题讲义落盘与摸底成果无痕融入。
- 升级 `assets/python/plot_helper.py` 至矢量文字转曲（`svg.fonttype="path"`）、自动空角说明框 `note_box`、16 向防压线 `label_point`、图例防撞与纯文字碰撞自检；同步在 `study-feedback` 补入零打字多候选卡顿先确认护栏。
- 升级 `src/blueprint-store.ts` 与 `src/client/card-preview.tsx`：精准识别 `卡 02_0.1`、`卡 03.1_0.1`、`卡 01.1` 等新编号并防正卡 `0.x` 标题误判；兼容 `./学习伴学/` 与 `./学习笔记/` 双目录扫描；放行并内联预览搬运入 `assets/` 的 `.png / .jpg / .jpeg / .webp` 位图原图；在 `validateSyncedNotes` 补入跳过卡头与代码块的正文漏网原件索引、全角感叹号与染色代码自检提醒。
- 升级 `scripts/lint-assets.mjs` 与 `tests/plugin.test.ts`：纳入 `assets/workflows/*.md` 双向路由对齐、行数与文风门禁，并补全 `study_read_workflow`、先修编号、多格式原图与索引告警单测。

## [0.2.0] - 2026-11-20

### Added
- 新增 GitHub Pages Format 1 市场索引自动发布与 Release 工作流（`.github/workflows/release-market.yml`），使通过 Discover 市场源安装的用户可按 DSH 原生 `update: 'git'` 机制感知升级。
- 新增非阻塞后端更新检查器 `src/update-checker.ts`（`24h` 成功缓存 / `6h` 失败负缓存、GitHub Releases 302 Location 探测 + npm `dist-tags` 回退、支持 `DSH_STUDY_NO_UPDATE_CHECK` / `NO_UPDATE_NOTIFIER` / `CI` 退出），并通过 `/overview` 透传 `update` 状态。
- 在 Web 右侧栏「伴学脉络」抽屉顶部新增轻量深浅色自适应更新提示横幅，支持一键查看 Release 说明与 7 天免打扰（零 LLM Token、零中断弹窗）。

## [0.1.0] - 2026-11-18

### Added
- 初始发布 `dsh-plugin-study`：`study` / `study-feedback` 双技能、受控工具（`study_read_reference`、`study_render_plot`、`study_sync_blueprint`）、右侧栏抽屉与 Format 1 市场索引脚本。
