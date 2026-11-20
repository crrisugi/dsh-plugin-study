# Changelog

All notable changes to `dsh-plugin-study` will be documented in this file.

## [0.2.0] - 2026-11-20

### Added
- 新增 GitHub Pages Format 1 市场索引自动发布与 Release 工作流（`.github/workflows/release-market.yml`），使通过 Discover 市场源安装的用户可按 DSH 原生 `update: 'git'` 机制感知升级。
- 新增非阻塞后端更新检查器 `src/update-checker.ts`（`24h` 成功缓存 / `6h` 失败负缓存、GitHub Releases 302 Location 探测 + npm `dist-tags` 回退、支持 `DSH_STUDY_NO_UPDATE_CHECK` / `NO_UPDATE_NOTIFIER` / `CI` 退出），并通过 `/overview` 透传 `update` 状态。
- 在 Web 右侧栏「伴学脉络」抽屉顶部新增轻量深浅色自适应更新提示横幅，支持一键查看 Release 说明与 7 天免打扰（零 LLM Token、零中断弹窗）。

## [0.1.0] - 2026-11-18

### Added
- 初始发布 `dsh-plugin-study`：`study` / `study-feedback` 双技能、受控工具（`study_read_reference`、`study_render_plot`、`study_sync_blueprint`）、右侧栏抽屉与 Format 1 市场索引脚本。
