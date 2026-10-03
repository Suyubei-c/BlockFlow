# 时块 BlockFlow · 路线图（Roadmap）

> 版本：Stage 8 后更新。每个阶段独立完成，阶段之间以 `docs/handoff.md` 交接，等待用户「继续下一阶段」。

## 阶段总览

| 阶段 | 名称 | 状态 | 说明 |
| --- | --- | --- | --- |
| Stage 0 | 项目基线、产品规格与交接机制 | ✅ 已完成 | 建立 9 份文档 + README，审查现有原型 |
| Stage 1 | Web 骨架、页面与本地存储 | ✅ 已完成 | 五页面可切换、localStorage 五项、静态校验 |
| Stage 2 | 任务输入、日期与自动估时 | ✅ 已完成 | 自动估时、任意日期、自定义重复 |
| Stage 3 | 固定时间、偏好时间与基础约束 | ✅ 已完成 | 固定占用（上课/通勤）、参数化日期、冲突提示加固 |
| Stage 3.5 | 重复规则精简与时间规则表 | ✅ 已完成 | 删除「每周同一天」、时间规则表（编辑/替换/暂停/恢复） |
| Stage 4 | 自动排期引擎 | ✅ 已完成 | 统一排期入口、固定任务补排、5–10 分钟缓冲、不排到过去、容量上限、缩短/顺延/调整 |
| Stage 5 | 历史与复盘增强 | ✅ 已完成 | 复盘八项统计、卡片状态规则、筛选、历史记录与详情、进度备注 |
| Stage 6 | 响应式与可访问性打磨 | ✅ 已完成 | 四档断点、深色对比、键盘/焦点、读屏标签、触控尺寸、减少动效 |
| Stage 7 | 后台计时与离开确认 | ✅ 已完成 | 时间戳恢复、离开阈值与四选项确认、pendingGap 持久化（关闭 D-08） |
| Stage 8 | PWA 基础 | ✅ 已完成 | manifest、Service Worker、应用图标、安装到桌面；file:// 不受影响 |
| Stage 9 | 全量验收、比赛演示与提交封版 | ✅ 已完成 | 导出/导入数据、90 秒演示脚本、架构/验收/提交清单文档；封版不改核心 |
| 待定 | 执行增强：进度备注与键盘操作 | ⬜ 待开始 | 进度备注已于 Stage 5 落地，剩余键盘项待确认编号 |

> 阶段定义以用户每次下发的为准；本表随之更新。

## Stage 1 · Web 骨架、页面与本地存储（已完成）

- 五个页面：今日、新建、执行、复盘、设置，均可切换。
- 移动端优先、桌面端宽屏布局、深色模式。
- localStorage 键 `blockflow.v1`：首次写示例、刷新保留、损坏恢复提示、旧字段补全。
- 加载/空状态/错误提示完整；新增全局 `error` / `unhandledrejection` 兜底。

## Stage 2 · 任务输入、日期与自动估时（已完成）

- 单/多任务输入、按行时长、用户填写时长。
- 自动估时：`estimateDuration` 按任务文本保守估算，用户填写优先。
- 日期：统一 `newDate`，今天/明天快捷 + 任意日期，三种模式共用。
- 重复：仅今天 / 每天 / 工作日 / 自定义重复（`repeatDays`）；「每周同一天」已于 Stage 3.5 移除。
- 保持 localStorage 向后兼容（`normalize` 补 `repeatDays` / `estimated`）。

## 待定 · 执行增强：进度备注与键盘操作

- 进度备注与「下次继续位置」已于 Stage 5 落地（`task.notes`/`task.resumeFrom`）。
- 离开询问已于 Stage 7 落地；剩余条目为执行页按钮状态与键盘可操作性，待用户确认阶段编号。

## Stage 3 · 固定时间、偏好时间与基础约束（已完成）

- 固定占用：设置页可增删（`settings.fixedBlocks`），支持名称、起止、生效星期；该日生效的占用并入 busy 与冲突检测。
- 参数化：`computeSlots(tasks, dateKey)` / `busyOf(fixed, dateKey)` / `fixedConflict(..., dateKey)` 按日期取用约束。
- 基础约束：睡眠边界（容量）+ 三餐 + 固定任务 + 固定占用构成不可占用集合；偏好时间软约束保留。
- 冲突提示加固：固定任务冲突给出详细文案并引导删除示例冲突项；失败走 `guard` + Toast + 内联提示，不静默。
- 兼容：`normalize` 兼容旧数据（缺 `fixedBlocks` 回退 `[]`），localStorage 键与顶层结构不变。

## Stage 3.5 · 重复规则精简与时间规则表（已完成）

- 重复规则仅保留 仅今天 / 每天 / 工作日 / 自定义；旧 `weekly` 迁移为 `custom`。
- 设置页「时间规则表」：编辑（复用编辑弹窗）、替换任务、暂停/恢复规则、删除（二次确认）。
- 暂停通过 Task `rulePaused` 实现：暂停后不占用固定/偏好时间，任务本身保留。

## Stage 4 · 自动排期引擎（已完成）

- 统一入口 `scheduleForDate(dateKey)`：锁定睡眠（容量窗口 `dayWindow`）、吃饭、固定占用、固定任务，再按「偏好 → 自由」顺序排布；渲染直接消费其结果，保证界面时间线与实际排期一致。
- 固定任务占 `min(时段, 目标)`，超出部分自动补排（`isExtension`）；放不下记 `overflow`，不删除任务。
- 任务之间保留 5–10 分钟缓冲（`bufferMinutes`）；不排到过去（`earliestMinute`）；容量上限检查（关闭 D-07）。
- `replanRemaining`：规则表编辑/替换/暂停/恢复/删除、设置变更、新增任务后立即重排，只重排未完成且非固定任务（关闭 D-10 前半）。
- 时间不足时 `shortageOptions` + `renderShortagePanel` 给出缩短/顺延/调整方案，用户点选才应用（关闭 D-10 后半）。
- 重复规则仅 `none/daily/weekdays/custom`，仅 custom 读 `repeatDays`。

## Stage 5 · 历史与复盘增强（已完成）

- 复盘统计扩展为八项：计划总时长、实际总时长、完成率、计划偏差、中断次数、中断总时长、顺延总时长、完成任务数（计划/实际）。
- 状态分布（待开始 / 进行中 / 已暂停 / 已完成）+ 全局完成率进度条（CSS 实现，无图表库）。
- 复盘卡片独立计算：目标条固定 100%、实际条按 `actual/planned`、超目标保持 100% 用超时色、右侧「分钟数 · 百分比」；状态规则：待开始不显示时长差 / 进行中·当前完成 x% / 已暂停·当前完成 x% / 提前完成(+提前 X 分钟) / 按时完成 / 超时(+超出 X 分钟)。
- 任务筛选：全部 / 已完成 / 未完成 / 有中断 / 已顺延；结果为空给空状态。
- 历史记录：最近有任务日期倒序列表（计划 / 实际 / 完成率 / 任务数），点击切换日期查看当天完整任务、实际用时、中断、顺延与进度备注；只读本地数据，不上传。
- 进度备注落地：执行页记录进度与「下次继续位置」（`task.notes` / `task.resumeFrom`），复盘与历史同步展示。
- 纯本地计算，未引入图表库 / 网络 / 后端；未改动自动排期核心算法。

## Stage 6 · 响应式与可访问性打磨（已完成）

- 响应式断点：`max-width:359px`（320 紧凑）、`360–767px`（375/430 移动）、`min-width:768px`（平板，主内容 760px）、`min-width:1200px`（大屏，主内容 1080px 居中、今日页双栏）。
- 防溢出：`html,body{overflow-x:hidden}` + 关键容器 `min-width:0`；长任务名 `overflow-wrap:anywhere` 不撑破卡片；时间线/规则表/复盘卡/设置表单/弹窗无横向滚动。
- 底部导航：`.app-main` 预留 `env(safe-area-inset-bottom)`，不遮挡最后一张卡片。
- 弹窗：`.modal-card` 内部滚动、`.modal-head` sticky 使关闭按钮始终可见；Esc 关闭 + `trapFocus` 键盘焦点陷阱 + 关闭回落触发元素。
- 可访问性标签：skip link、`role="tabpanel"`、tab 的 `aria-controls`/`aria-selected`、hint `aria-live`、筛选 `aria-pressed`、规则表/固定占用按钮与输入 `aria-label`。
- 焦点与错误：`:focus-visible` 3px outline；错误/成功提示加 `border-left` + 图标（不只靠颜色）。
- 触控尺寸：`.icon-btn` 44×44、`.btn min-height:44px` 等。
- 深色模式对比度补丁 + `prefers-reduced-motion` 全局降级。
- 未改数据模型与排期/复盘核心，未引入依赖。

## Stage 7 · 后台计时与离开确认（已完成）

- 时间恢复：Task 增 `lastVisibleAt`/`pendingGapStart`/`pendingGapEnd`/`pendingGapSeconds`；计时一律基于 `Date.now()` 时间戳（`onHidden`/`onVisible` + `visibilitychange`/`pagehide`/`beforeunload`/`pageshow`），不依赖 `setInterval`。
- 离开阈值：默认 5 分钟，设置页可调 1–60（`leaveThresholdMinutes` 钳制）；未超阈值直接继续计时，超阈值建 pendingGap 并弹确认框。
- 四选项结算：全部计入 / 全部不计入 / 只计入一部分（0~离开分钟数）/ 从离开时暂停；统一经 `leaveBase` 保留「离开前真实工作 + 返回后真实时长」，并写 `interrupts` 的 `counted` 标记；不计入与暂停后调用 `replanRemaining` 重排。
- 持久化与恢复：pendingGap 与选择写入 `blockflow.v1`，刷新/重开后 `init` 恢复未确认区间；确认后一律 `clearPendingGap` 防重复扣除；`safeSeconds`/`secondsBetween` 对异常值安全回退。
- 关闭 D-08；未改排期/复盘核心，未引入依赖。

## Stage 8 · PWA 基础（已完成）

- 新增 `manifest.webmanifest`（name/short_name/start_url/scope/display/theme_color/background_color/icons，全部相对路径）与 `icons/`（192、512、maskable-512，纯 Node 零依赖生成的 PNG）。
- 新增 `service-worker.js`：`CACHE_VERSION` 版本号；`install` 预缓存核心静态资源；`activate` 仅清理 `blockflow-static-` 前缀旧缓存；`fetch` 导航请求网络优先、离线回退 `index.html`，静态资源缓存优先；不触碰 localStorage。
- `app.js` 新增 `registerServiceWorker`（仅 http/https 注册）与 `setupInstallPrompt`（`beforeinstallprompt` 显示「安装到桌面」按钮，不支持/file:// 隐藏）。
- `file://` 直接打开不受影响（不注册 SW、安装面板隐藏、try/catch 兜底）；不请求任何外部字体/图片/脚本；不引入依赖、后端、账号、云同步、AI API。

## Stage 9 · 全量验收、比赛演示与提交封版（已完成）

- **数据安全**：设置页「数据」面板新增「导出数据」（Blob 下载本地 JSON）与「导入数据」（文件选择 + 前置格式校验 + 覆盖二次确认 + 失败保留原数据 + 导入后切回今日刷新）；清空全部数据、载入示例数据均有二次确认；全程不经云端。
- **比赛演示材料**：`docs/demo-script.md` 重写为 90 秒演示脚本（含 9 步时间轴与 60 秒精简版）；新增 `docs/architecture.md`、`docs/final-checklist.md`、`docs/known-limitations.md`、`docs/submission-package.md`。
- **封版**：不再新增非必要功能；所有未执行测试在 `docs/final-checklist.md` 中明确标记为「未执行」，不声称通过；PWA 离线部分（SW 注册、离线刷新、数据保留）已在 `http://localhost:8080` 实测通过。
- **未改核心**：排期、复盘/历史、响应式/可访问性、计时/离开确认、PWA 均未回退。

## 每阶段通用要求

1. 先读 `docs/handoff.md` 与现有代码，再做增量修改。
2. 不引入依赖、后端、数据库，不改变纯静态交付形态。
3. 保持 localStorage 数据兼容，旧数据不得报错或白屏。
4. 失败必须可见，禁止静默失败。
5. 结束后更新 `docs/handoff.md` 并输出 TIMEBLOCK HANDOFF。