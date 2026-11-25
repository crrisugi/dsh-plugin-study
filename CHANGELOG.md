# Changelog

All notable changes to `dsh-plugin-study` will be documented in this file.

## [0.2.9] - 2026-11-25

### Changed
- 全量对齐 `study` 伴学规程至 `v0.2.9`（完整保留 `study_read_reference`、`study_read_workflow`、`study_render_plot`、`study_sync_blueprint` 与右侧抽屉联动）：
  - 符号保原与前置补讲规范：明确非同式写不开时不擅自改添下标、英文缩写上下标与多字母缩略记号首次出场须写全英文原词与中文含义；厘清原书略过前置的“直接引用”与“拆开补讲”分界并支持联网核实；正卡成段补讲前置须用 `前置铺垫：…` 隔开且补完切回目标正卡免重测、补讲均讲到接通正卡即收手；同步对齐 `assets/workflows/{archiving,long-corpus}.md` 的先修切面免测边界及速通节选“从零搭桥”单发调档题。
  - 倒数域原域尺度先行与前提校准：`assets/references/transform-phasor.md` 第 2 节拆清“原域尺度先行（倒数域变量与原域尺度联立约束时先回同量纲原域立画面并按需举原域小例，再取倒数翻回）”与“单向切域核对（限定于解微分或卷积方程）”，并在主干对照表轻提；顺带为 `assets/references/discrete-state.md` 补齐“讲解算法优化且存在可对照的朴素解法”前提。
  - 多步搭桥逐段落地与边界临界分段：`assets/skills/study/SKILL.md` 第二步将“兑现符号与选答”与“逐段兑现搭桥”拆短单列，要求“从零搭桥”含多步链条时须用易心算小例逐段搭通至临界分界与分支跳转；第三步放宽同算例调临界参数对比限制，并新增全理工通用的“边界临界分段”（并列边界来源与约束范围 $\to$ 判明主导限制与受截断物理量/定义域并按需配易心算对照 $\to$ 按主导边界分段、明确临界等号归属并如实命名分段）。
  - 全套规程与插件文案专业化措辞统一清理：清除 `assets/skills/study/SKILL.md`、4 份 `assets/workflows/*.md`、10 份 `assets/references/*.md` 与 `src/tools.ts` / `README.md` 中的口语俗词与比喻表达，统一对齐 `teaching-style.md` 的清朗现代书面语风格。
  - 实测边界收口：`assets/skills/study/SKILL.md` 收紧外部定理/略证规律免摸底边界（仅借结论过渡时免摸底，凡须凭其联立推导、分析机制或划临界分段者仍按独立底座测含义、趋势与约束而不追溯证明）；强化“边界临界分段”对定义域越界与无量纲比值分界伪装的识别，要求分段前先并列写出各独立边界并代入临界取等点核对定性结论定等号归属；`assets/references/transform-phasor.md` 扩展覆盖衰减率/时间常数并要求各方统一换算原域完成比较后再整体转回变换域，杜绝单方中途折返消元。

## [0.2.8] - 2026-11-25

### Changed
- 全量对齐 `study` 伴学规程至 `v0.2.8`（完整保留 `study_read_reference`、`study_read_workflow`、`study_render_plot`、`study_sync_blueprint` 与右侧抽屉联动）：第二轮发首卡摸底题前先在正文开头亮出初拟分卡路线并注明摸底后定稿，收齐摸底后再写入 `00_伴学脉络蓝图.md` 与刷新抽屉。
- 废止单篇合存 `01_全篇脉络总卡.md` 并删除 `assets/workflows/long-corpus.md` 重复条目：单篇与长卷全面统一为逐卡按需落盘（`直觉速通` 存轻量短卡、`标准推演 / 深度精读` 存完整讲义卡），兼容混搭核心卡临时升档。
- 统一各档整卡末尾选择权与配图延迟入库：写目录模式下非末卡提供“落盘 / 落盘并继续 / 继续（跳过本卡存盘）”、末卡提供“落盘 / 继续（跳过存盘结课）”；`assets/workflows/plotting.md`、`archiving.md` 与 `study_render_plot` 明确讲卡阶段配图先存临时目录，确认落盘该卡后再写入工作区 `assets/`。
- 右侧抽屉与盘面校验同步升级：取消 `src/client/tab.tsx` 快捷复制按钮对 `直觉速通` 的限制，改为所有档位 `active` 卡均提供「落盘并继续 / 落盘 / 继续」快捷复制；`src/blueprint-store.ts` 与 `assets/python/check_notes.py` 支持解析蓝图 `## 三、已学主线与阶段收获` 的 `（未落盘）` 标记以标记 `done` 且免报缺文件告警，并在 `tests/plugin.test.ts` 补齐单测。

## [0.2.7] - 2026-11-23

### Changed
- 全量对齐 `study` 伴学规程至 `v0.2.7`（完整保留 `study_read_reference`、`study_read_workflow`、`study_render_plot`、`study_sync_blueprint` 与右侧抽屉联动）：将主干“引用直写算式”拆为精简版 `不夹原件编号` 与 `引用直写算式` 两短项，要求跨卡、隔小节、对比或代入前先完整复写当前用到的原式，且同一统称下包含总式或多条子式时引用其中某一条须写明具体子式名或作用、不拿统称笼统代指。
- 蓝图主线账本与顶部回放白话松绑：取消 `assets/workflows/archiving.md` 的 `25~45` 字硬限与主干“更早步骤并成半句”要求，改为 `1` 条 `1~2` 句通顺动作白话（先修铺垫卡 `1` 句短话挂在正卡前），超过 `5` 条时将更早正卡与已用完先修卡合并为 `1` 条完整白话句、最近 `3~4` 张正卡原样列出。
- 明确交互提问工具仅限开讲前短提示与总图确认环节；长讲义与半步停顿末尾一律禁弹交互控件，同时取消 `k-A` 半步预测与整卡末尾轻自核单选，改以一句平实短话收尾确认（配合右侧栏抽屉快捷复制“落盘/继续”）。
- 全套内置资产与工具文案去重统一：精简 `assets/skills/study/SKILL.md`、`assets/workflows/archiving.md`、`assets/workflows/plotting.md`、`assets/workflows/long-corpus.md`、`assets/python/plot_helper.py` 顶部注释及 `6` 份 `assets/references/*.md` 的跨文件复读、长清单与重复提醒，并将 `src/tools.ts` 中 `study_render_plot` 的 `rawSvg` 描述统一为柔和浅底圆角 `<svg>`。
- 同步讲义分层拆块与缩进公式防呆：`assets/workflows/teaching-style.md` 将多步拆块升级为按体量分层（轻量单层编号、重载改用 `###` 三级小标题，禁止嵌套子列表夹写 `$$` 或 4 空格缩进续行）；`assets/python/check_notes.py` 与 `src/blueprint-store.ts`（`validateSyncedNotes`）同步新增 CommonMark 缩进代码块含公式拦截并在 `tests/plugin.test.ts` 补齐单测。
- 收口公开版 `study-feedback` 与资产门禁：`assets/skills/study-feedback/SKILL.md` 聚焦纯脱敏诊断与邮件 / GitHub Issue 外发（移除本地账本追记分支与描述中的复盘字样），清理 `.gitignore` 中的 `**/local_config.json` 规则，并泛化 `scripts/lint-assets.mjs` 的跨平台路径隐私检测。

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
