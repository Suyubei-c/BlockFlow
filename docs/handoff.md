# 时块 BlockFlow · 交接文档（Handoff）

## 当前状态

- **当前阶段**：Stage 9 已完成（全量验收、比赛演示与提交封版）；**项目已封版**
- **下一阶段**：无（封版，等待用户指定新需求才继续）
- **仓库状态**：新增数据导出/导入能力与演示/架构/验收/提交文档；代码与 PWA 未回退
- **最后更新**：2026-10-04

## 阶段进度

| 阶段 | 状态 |
| --- | --- |
| Stage 0 项目基线、产品规格和交接机制 | ✅ completed |
| Stage 1 Web 骨架、页面和本地存储 | ✅ completed |
| Stage 2 任务输入、日期和自动估时 | ✅ completed |
| Stage 3 固定时间、偏好时间与基础约束 | ✅ completed |
| Stage 3.5 重复规则精简与时间规则表 | ✅ completed |
| Stage 4 自动排期引擎 | ✅ completed |
| Stage 5 历史与复盘增强 | ✅ completed |
| Stage 6 响应式与可访问性打磨 | ✅ completed |
| Stage 7 后台计时与离开确认 | ✅ completed |
| Stage 8 PWA 基础（manifest + Service Worker + 安装到桌面） | ✅ completed |
| Stage 9 全量验收、比赛演示与提交封版 | ✅ completed |

## Stage 5 验收（历史与复盘增强）

| # | 要求 | 现状 |
| --- | --- | --- |
| 1 | 目标条固定 100%，不用全局最大值 | ✅ `barRow("目标", planned, 100, "plan", false)` |
| 2 | 实际条按 `actualMinutes/plannedMinutes` | ✅ 每卡片独立 `pct = min(actMin/planned,100)*100` |
| 3 | `plannedMinutes=0` 时 0% 不除零 | ✅ `planned>0?...:0`；`reviewStatusKind` 单列处理 |
| 4 | 超目标保持 100% 且用超时色 | ✅ 实际条宽封顶 100%，`over` 加 `.actual.over`（`--danger`） |
| 5 | 右侧同时显示「分钟数 · 百分比」 | ✅ `.bar-value` = `N 分钟 · P%` |
| 6 | 状态规则（待开始/进行中/暂停/提前/按时/超时 + 差值） | ✅ `reviewStatusKind` + `reviewCard` 徽章与差值文案 |
| 7 | 顶部总体统计可保留全局比例 | ✅ `revRate`/`revRateBar` 用全局比例；卡片独立 |
| 8 | 复盘六项增强（计划总时长/实际总时长/完成率/中断次数/中断总时长/顺延任务数） | ✅ 八项统计 + 状态分布 + 偏差 |
| 9 | 计划完成与实际完成任务数 | ✅ `revDoneCount` = `已完成 / 总数 个` |
| 10 | 状态分布（待开始/进行中/暂停/完成） | ✅ `revDist` 四格 `dist-grid` |
| 11 | 计划与实际偏差 | ✅ `revDeviation` 带正负号 |
| 12 | 无任务空状态 | ✅ `renderReview` 区分「无任务」与「筛选为空」 |
| 13 | 不加学习/健身/健康建议 | ✅ 全程无此类文案 |
| 14 | 日期切换查看历史 | ✅ `historyList` 点击 → `setDate()` |
| 15 | 最近有任务日期列表 | ✅ `historyDates()` 倒序，`historyCount` 显示天数 |
| 16 | 每日期显示计划/实际/完成率/任务数 | ✅ `.history-item` 四项 |
| 17 | 当天完整任务、实际用时、中断、顺延、进度备注 | ✅ `renderHistoryDetail` |
| 18 | 只读本地 localStorage，不上传 | ✅ 无网络调用 |
| 19 | 编辑/计时/备注更新后历史与复盘同步 | ✅ 均在 `render()` 时重算 |
| 20 | 删除任务后历史数据正确更新 | ✅ `removeTask` 后重算；空桶被 `historyDates` 过滤 |
| 21 | 筛选：全部/已完成/未完成/有中断/已顺延 | ✅ `reviewFilters` 委托 + `reviewFilterMatch` |
| 22 | 历史按日期倒序、任务按计划开始时间排序 | ✅ `historyDates` 倒序；`sortTasks` 按 `planStart` |
| 23 | 筛选结果为空显示空状态 | ✅ 独立空状态文案 |
| 24 | 只用 HTML/CSS/原生 JS，图表用 CSS/SVG，不改排期核心 | ✅ 无依赖、无图表库；未改 `computeSlots`/`scheduleForDate` |
| 25 | 验收 1：英语 180/实际 2 分钟 → 提前完成 | ✅ 单测通过（`early`） |
| 26 | 验收 2：30 分钟待开始 → 待开始不显示 -30 | ✅ 单测通过（`pending`，无差值） |
| 27 | 验收 3：目标/实际均 60 → 按时完成 | ✅ 单测通过（`ontime`） |
| 28 | 验收 4：目标 60/实际 90 → 超时 | ✅ 单测通过（`over`） |
| 29 | 验收 5：有中断显示次数与中断总时长 | ✅ `interruptMinutes` 单测通过（含进行中按当前计） |
| 30 | 验收 6：历史切换与筛选正常 | ✅ 渲染冒烟 + id 校验通过 |
| 31 | 验收 7：计时/编辑/加备注后复盘实时更新 | ✅ 渲染时重算 |
| 32 | 验收 8：刷新后历史与复盘仍存在 | ✅ 数据在 `blockflow.v1`，`normalize` 兼容 |

本阶段代码改动（增量，未重写、未加依赖、未改排期核心）：

- `app.js`
  - 新增 `normalizeNotes(list)`：归一化 `{text,at}[]`，剔除空项（位于 `normalizeFixedBlocks` 之前）。
  - `normalize()` / `baseTask()`：Task 增 `notes`、`resumeFrom`（旧数据补空，不破坏兼容）。
  - 新增 `renderRunNotes` / `renderNoteList` / `saveRunNote`：执行页进度备注读写；`saveRunNote` 先校验「备注或继续位置」至少一项非空再写入。
  - 重写 `renderReview`：八项统计 + 状态分布 `revDist` + 完成率条 `revRateBar` + 筛选 + 空状态区分。
  - 新增 `reviewStatusKind(status, duration, actualSec)`：状态归类单一入口（`over/early/ontime` + `pending/doing/paused`）。
  - 新增 `reviewCard(t)`：单卡片渲染（徽章、差值、备注）；`barRow` 显示「分钟 · 百分比」。
  - 新增 `interruptMinutes(tasks)`、`reviewFilterMatch(t, filter)`。
  - 新增 `daySummary` / `historyDates` / `renderHistory` / `renderHistoryDetail`。
  - `render()` 复盘分支改为 `renderReview(); renderHistory(); renderHistoryDetail();`。
  - `bind()` 新增 `reviewFilters` 委托、`historyList` 委托、`runNoteAddBtn`。
- `index.html`
  - 执行页新增「进度备注」面板（`runNoteHint/runNoteEmpty/runNoteCard/runResumeFrom/runNoteInput/runNoteAddBtn/runNoteList`）。
  - 复盘视图重构：八张统计卡 + `revRateBar` + `revDist` + 筛选栏 `reviewFilters` + `reviewList` + 历史面板（`historyCount/historyList`）+ 详情面板（`historyDetailBox`）。
- `styles.css`
  - 新增 `.rate-bar-wrap`/`.rate-bar(.ok/.warn/.over)`、`.dist-grid/.dist-item/.dist-num/.dist-label`、`.filter-bar/.filter-chip(.is-active)`、`.note-list/.note-item/.note-time/.note-text/.note-empty`、`.history-list/.history-item(.is-active)/.history-date/.history-stats/.history-rate`、`.history-detail/.history-detail-head/.history-task/.history-task-top/.history-task-title`、`.review-notes/.note-resume`。

## 数据结构变化

- Task 新增：`notes: {text:string, at:number}[]`、`resumeFrom: string`（进度备注与下次继续位置，关闭 D-09）。
- 归一化：`normalizeNotes` 保证 `notes` 始终为数组；`resumeFrom` 非字符串归一化为 `""`。
- 复盘筛选 `reviewFilter` 为模块内运行时状态，**不持久化**。
- localStorage 键与顶层结构不变：`blockflow.v1`、`version: 2`。

## 仓库真实文件

```
BlockFlow/
├── index.html            页面骨架（五视图 + 弹窗 + 时间不足面板 + 数据导入/导出 + Toast）
├── styles.css            移动端优先样式（含深色模式、可访问性、Stage 9 数据面板）
├── app.js                数据/调度/计时/渲染/PWA/导入导出（单文件 IIFE）
├── manifest.webmanifest  PWA 应用清单（固定 id/start_url/scope）
├── service-worker.js     离线缓存（仅 Cache Storage）
├── icons/                应用图标（192 / 512 / maskable-512）
├── README.md             运行说明、验收清单、PWA 与数据导入导出说明
└── docs/                 产品规格、数据模型、规则、架构、演示、验收与交接
    ├── architecture.md       纯前端架构、数据流、计时与排期
    ├── demo-script.md        90 秒演示脚本
    ├── final-checklist.md    最终验收清单与真实测试结果
    ├── known-limitations.md  已知限制
    ├── submission-package.md 提交文件清单
    └── ...（product-spec / ui-spec / data-model / scheduling-rules / timer-rules / decisions / roadmap / handoff）
```

## Stage 5 收尾修复（2026-10-03）

针对 Stage 5 交付后用户实测反馈的两个缺陷做增量修复（未重写、未引入依赖、未改自动排期算法）：

### 一、批量目标时长解析
- **问题**：`addTasks` 仅用 `split(",")`，中文逗号/顿号/分号/换行/空格切不开；`resolveDuration` 不识别全角数字与「分钟」后缀；错误文案未指出具体值。
- **修复**：
  - 新增 `toHalfWidth()`：全角数字/符号 → 半角（含全角空格）。
  - 新增 `cleanDurationToken()`：去空白与零宽字符，去「分钟/分/min/m」后缀。
  - `resolveDuration()`：先归一化再校验，非法值错误文案含具体输入「目标时长「abc」需为……」。
  - 新增 `splitDurations()`：按 `[,，、;；\s]+` 切分，逐项去除零宽字符与空项；支持英文/中文逗号、顿号、分号、换行、连续空格、全角数字。
  - `addTasks` 改用 `splitDurations()`；批量留空/默认时长留空自动估时不再报错。
  - `bind()` 新增 `clearNewError`：`bulkInput`/`defaultDuration`/`bulkDurations` 任一处 input 即清除旧错误提示（原逻辑只清 `touched`，错误文案残留）。
- **验证**：读书/看报/写字三行 + 批量 `30, 60, 90` 一次性添加成功，时长分别为 30/60/90，提示「已添加 3 个任务」，数据已写入 `blockflow.v1`。

### 二、时间线文字粘连
- **问题**：`.tl-meta` 默认 block，非固定任务的「时间范围」与「目标时长」两个相邻 span 拼成 `21:31 – 22:1645m`；无排期时显示 `--30m`。
- **修复**：
  - 新增 `formatTimeRange(slot, duration)`：统一输出「21:31 – 22:16 · 45 分钟」；无 slot 返回空串。
  - `renderToday` 时间线：非固定任务有排期用 `<span class="tl-dur">` 单元素承载「范围 · 分钟」，无排期显示「时间未安排」+ 独立「目标」；`tl-time` 无排期由 `--` 改为「待排」。
  - `renderToday` 任务列表：非固定任务有排期显示「计划 HH:MM」+「范围 · 分钟」，无排期「时间未安排」+「目标」；不再出现 `--`。
  - `styles.css`：`.tl-meta` 改为 `display:flex; flex-wrap:wrap; align-items:center; gap:4px 10px`，子 `span` `white-space:nowrap`；新增 `.tl-dur`（tabular-nums）与 `.tl-noslot`（斜体）。
  - 复盘页与任务列表原本已用 `barRow`（含「分钟 · 百分比」）与 `.task-meta`（flex+wrap+gap），无粘连，未改动。

## Stage 6 验收（响应式与可访问性打磨）

| # | 要求 | 现状 |
| --- | --- | --- |
| 1 | 检查 320/375/430/768/1200px 宽度 | ✅ 新增 `max-width:359px`、`360–767px`、`min-width:768px`、`min-width:1200px` 四档断点 |
| 2 | 手机底部导航不遮挡内容并预留安全区 | ✅ `.app-main` padding-bottom = `calc(var(--tabbar-h) + 26px + env(safe-area-inset-bottom))` |
| 3 | 桌面主内容合理最大宽度不无限拉伸 | ✅ 768px→`max-width:760px`；1200px→`max-width:1080px` 且居中 |
| 4 | 时间线/任务卡/复盘卡/规则表/设置表单/弹窗不横向溢出 | ✅ `html,body{overflow-x:hidden}` + 关键容器 `min-width:0`；临时脚本确认无 100vw/固定宽溢出源 |
| 5 | 长任务名换行不撑破卡片 | ✅ 标题类 `overflow-wrap:anywhere; word-break:break-word` |
| 6 | 固定时间/星期筛选/规则表/筛选按钮小屏正常换行 | ✅ `.task-actions`/`.fb-times`/`.field-row` `flex-wrap:wrap` |
| 7 | 弹窗超高内部滚动、关闭按钮始终可见 | ✅ `.modal-card{max-height:88vh;overflow-y:auto}`；`.modal-head` `position:sticky` |
| 8 | Toast 与错误提示不出屏 | ✅ `.toast` 左右安全边距；`.hint` 内嵌、可换行 |
| 9 | 可点击区域尽量 ≥44px | ✅ `.icon-btn` 44×44、`.btn` `min-height:44px`、`.task-check` 26px（含 label 点击域） |
| 10 | 按钮/输入框/选择框有 label 或 aria-label | ✅ 规则表与固定占用按钮补 `aria-label`；固定占用输入框补 `aria-label`；表单沿用 `<label>` 包裹 |
| 11 | 弹窗支持 Esc 关闭和键盘 Tab | ✅ Esc 关闭两弹窗；新增 `trapFocus` 焦点陷阱 + `showModal/hideModal` 焦点回落 |
| 12 | 焦点样式明显、错误不能只靠颜色 | ✅ `:focus-visible` 3px outline；错误/成功提示加 `border-left` + `::before` 图标 |
| 13 | 深色模式文字/按钮/输入框/错误提示可读 | ✅ 深色补丁块覆盖 `.chip`/`.btn.ghost`/`.hint`/`.rate-bar-wrap`/焦点色等 |
| 14 | 支持 prefers-reduced-motion | ✅ 全局降级动画/过渡/平滑滚动 |
| 15 | 不加学习/健身建议、后端、账号、云同步 | ✅ 无新增依赖与服务；仅 CSS/HTML/JS 增量 |

本阶段代码改动（增量，未重写、未加依赖、未改排期核心）：

- `index.html`
  - `<body>` 顶部新增 `<a class="skip-link" href="#mainContent">跳到主要内容</a>`；`<main>` 加 `id="mainContent" tabindex="-1"`。
  - 五个视图 `<section>` 加 `role="tabpanel"`；底部导航 `<nav role="tablist" aria-label="主导航">`，五个 tab 加 `aria-controls`/显式 `aria-selected`，图标 span `aria-hidden`。
  - 编辑弹窗新增 `.modal-head`（标题 + 关闭 `icon-btn`）；替换弹窗补 `.modal-head`、`aria-describedby="replaceDesc"`。
  - 四个 hint 容器（`newHint`/`settingsHint`/`editHint`/`replaceHint`）加 `role="status" aria-live="polite"`。
  - 复盘筛选 `reviewFilters` 去掉误用的 `role="tablist"`，五个 `filter-chip` 加 `aria-pressed`。
- `app.js`
  - 新增 `focusables(modal)` / `trapFocus(e, modal)` / `showModal(modal)` / `hideModal(modal)`；`openEdit`/`openReplace` 改用 `showModal`，`closeEdit`/`closeReplace` 改用 `hideModal`（记录并回落触发元素）。
  - `keydown` 处理：Esc 关闭两弹窗并 `return`；未关闭弹窗时 Tab 走 `trapFocus`。
  - `renderRules` 四个操作按钮补 `aria-label`（含任务名）；`renderFixedBlocks` 名称/开始/结束输入补 `aria-label`、删除按钮补 `aria-label`、星期容器加 `role="group" aria-label`。
  - 复盘筛选点击处理同步 `aria-pressed`。
- `styles.css`
  - 末尾追加「Stage 6」大段：防横向溢出、`.skip-link`、`:focus-visible`、错误/成功非纯色提示、触控尺寸、`.modal-head` sticky、底部安全区、四档断点、`prefers-reduced-motion` 降级、深色模式补丁。

## Stage 7 验收（后台计时与离开确认）

| # | 要求 | 现状 |
| --- | --- | --- |
| 1 | 正在执行任务保存 startedAt/lastVisibleAt/actualSeconds/pendingGap*/interruptedAt/status | ✅ Task 增 `lastVisibleAt`/`pendingGapStart`/`pendingGapEnd`/`pendingGapSeconds`；计时基于 `Date.now()` 时间戳恢复 |
| 2 | 不能只依赖 setInterval，用时间戳恢复 | ✅ `currentElapsed`/`leaveBase` 全用 `Date.now()`；`tick` 仅用于显示 |
| 3 | 进入后台/锁屏/隐藏记录 lastVisibleAt | ✅ `onHidden`（`visibilitychange` hidden / `pagehide` / `beforeunload`）记录 |
| 4 | 重新可见/重开计算离开时长 | ✅ `onVisible`（`visibilitychange` visible / `pageshow`）计算 `secondsBetween` |
| 5 | 无正在执行任务时忽略离开检测 | ✅ `runningTask()` 仅返回 `status==="doing"`，否则 `state.leaveFlow=null` |
| 6 | 用户未确认前不重复计算同一离开区间 | ✅ `ensurePendingGap` 见 `state.leaveFlow.taskId===t.id` 直接返回；`pendingGapStart` 兼作探针 |
| 7 | 离开阈值默认 5 分钟，设置页可调 1–60 | ✅ `DEFAULT_SETTINGS.leaveThreshold=5`；`leaveThresholdMinutes` 钳制 1–60；设置页 `max="60" value="5"` |
| 8 | 不超过阈值继续计时不弹窗 | ✅ `awaySec<=threshold` 直接推进 `lastVisibleAt`（验收 2） |
| 9 | 超过阈值创建 pendingGap 并弹确认框 | ✅ `onVisible` 建 pendingGap → `ensurePendingGap` → `openLeaveModal` |
| 10 | 弹窗标题「你离开了 X 分钟，这段时间算入「任务名称」吗？」 | ✅ `openLeaveModal` 设置 `leaveModalTitle` |
| 11 | 选项 1 全部计入 | ✅ `leaveCountAll`（验收 4） |
| 12 | 选项 2 全部不计入 | ✅ `leaveCountNone`，`startedAt=当前`、`replanRemaining`（验收 5/9） |
| 13 | 选项 3 只计入一部分（0~离开分钟数） | ✅ `leaveCountPart` 校验区间并记录实际计入/未计入（验收 6） |
| 14 | 选项 4 从离开时暂停 | ✅ `leavePauseFromAway`：保留离开前用时、`startedAt=null`、`status=paused`、`interruptedAt=离开开始`、重新排期（验收 7） |
| 15 | pendingGap 与用户选择写入 localStorage；刷新/重开恢复未确认 pendingGap | ✅ `normalize` 保留字段；`init` 扫描 `activeId`/全部任务恢复（验收 8） |
| 16 | 时间异常/负数/超范围安全回退为 0 | ✅ `safeSeconds`/`secondsBetween`；`ensurePendingGap` 异常区间清空 |
| 17 | 确认后 pendingGap 清空避免重复扣除 | ✅ 四选项均 `clearPendingGap`；`dismissLeave` 统一清理（验收 10） |
| 18 | 离开确认只作用于当前正在执行的任务 | ✅ 全部结算以 `state.leaveFlow.taskId` 定位任务 |
| 19 | 不影响开始/暂停/继续/完成/复盘 | ✅ 未改 `startTask`/`pauseTask`/`resumeTask`/`completeTask`/复盘核心，仅新增钩子（验收 11） |
| 20 | 不引入依赖/后端/云同步/健康建议 | ✅ 纯静态增量；无网络调用；无健康类文案 |

本阶段代码改动（增量，未重写、未加依赖、未改排期/复盘核心）：

- `app.js`
  - `DEFAULT_SETTINGS.leaveThreshold` 15 → **5**（1–60 钳制）；`state` 增 `leaveFlow`（运行时待确认，不持久化）与 `lastActivityAt`。
  - 新增 `MAX_SECONDS`/`safeSeconds`/`secondsBetween`/`leaveThresholdMinutes`（统一时间安全口径）。
  - `normalize()` / `baseTask()`：Task 增 `lastVisibleAt`/`pendingGapStart`/`pendingGapEnd`/`pendingGapSeconds`（旧数据补默认）；`saveSettings` 阈值校验改为 1–60。
  - 新增离开流程：`runningTask`/`taskRemainingMinutes`/`onHidden`/`onVisible`/`ensurePendingGap`/`clearPendingGap`/`recordLeaveInterrupt`/`openLeaveModal`/`leaveBase`/`leaveCountAll`/`leaveCountNone`/`leaveCountPart`/`leavePauseFromAway`/`closeLeaveFlow`/`dismissLeave`。
  - `startTask`/`resumeTask` 设 `lastVisibleAt=startedAt` 并 `clearPendingGap`；`resumeTask` 补「无未结束中断才记中断」防重复。
  - `renderRun` 增「剩余」`runRemain` 与「离开 N 分钟，待确认」状态；旧离开提醒改用 `leaveThresholdMinutes()`。`renderInterrupts` 增 `.it-tag.counted/.uncounted`。
  - `bind()` 增 `visibilitychange`/`pagehide`/`beforeunload`→`onHidden`，`pageshow`/`visibilitychange`→`onVisible`；`leaveModal` 四个选项按钮 + 取消监听；Esc 增 `leaveModal` 最高优先级 + `trapFocus`。
  - `init()` 在 `switchView` 后恢复未确认 pendingGap（`activeId` 优先，缺失时扫描全部任务）。
- `index.html`
  - 执行页 `run-meta` 增「剩余 <b id="runRemain">0</b> 分钟」。
  - 设置页「缓冲与提醒」→「缓冲与离开确认」，阈值 label 改「离开确认阈值（分钟，1 ~ 60）」、`max="60" value="5"`。
  - 新增 `#leaveModal`（`.modal-head` + 标题 `leaveModalTitle` + 关闭、离开区间 `leaveRange`、四选项 `leaveAllBtn`/`leaveNoneBtn`/`leavePauseBtn`、部分计入 `leavePartMinutes`+`leavePartBtn`、提示 `leaveHint`）。
- `styles.css`
  - 末尾追加「Stage 7」块：`.leave-options`/`.leave-part-row`、`.it-tag.counted`/`.it-tag.uncounted`（文字 + 边框，不只靠颜色）、`.run-status.doing` 数字等宽、深色补丁。

## Stage 7 修复：离开确认弹窗时间区间一致性（2026-10-04）

**问题**：弹窗标题显示「你离开了 16 分钟」，区间却显示「22:08 – 08:00（约 16 分钟）」——标题与区间来自不同来源（一个用缓存 `pendingGapSeconds`、一个用时间戳），跨天时未显示日期，无法判断真实区间。

**修复**（增量，未重写、未改排期/复盘逻辑、未加依赖）：
- 新增 `fmtDateTime(ts, withDate)`（带日期 24 小时制，如 `10月4日 22:08`）、`fmtLeaveSpan(seconds)`（秒→人类可读：`16 分钟` / `9 小时 52 分钟`）、`sameDay(a, b)`。
  - 注意：既有 `fmtDuration(min)` 接收**分钟**，为避免同名覆盖导致语义变更，新函数命名为 `fmtLeaveSpan`。
- `ensurePendingGap`：不再直接信任 `pendingGapSeconds`，一律由 `pendingGapStart`/`pendingGapEnd` 现算 `gapSec`；`end<=start` 或 `gapSec<=0` 时清空异常区间；每次 start/end 变化后立即重算并回写缓存。
- `openLeaveModal(t, start, end, gapSec)`：标题与区间共用**同一份** `gapSec`；同天显示 `10月4日 22:08 – 22:24（16 分钟）`，跨天显示 `10月4日 22:08 – 10月5日 08:00（9 小时 52 分钟）`，超 12 小时两端均带完整日期与总时长；统一 24 小时制。
- `onHidden`：已有未确认 `pendingGapStart` 时不覆盖；开始新区间时同步清理旧 `pendingGapEnd`/`pendingGapSeconds`。
- `onVisible`：已有 `pendingGapStart` 时先用当前时间更新 `pendingGapEnd` 再重算；`end<=start` 清空。
- 四个结算选项（全部计入/不计入/部分计入/从离开时暂停）统一复用 `state.leaveFlow` 中与弹窗相同的 `start`/`end`/`seconds`，保证「所见即所算」；确认后照常 `clearPendingGap`。
- `renderRun` 的「待确认」文案改为按时间戳现算，不再读缓存。
- 文件：`app.js`（新增 3 个工具函数，改 `ensurePendingGap`/`openLeaveModal`/`onHidden`/`onVisible`/四结算/`renderRun`）。`index.html`/`styles.css` 无需改动。

**验证**：`node --check` 通过；临时 vm 沙箱脚本（可控时钟）**22/22 PASS**，含同天 16 分钟、跨天 9 小时 52 分钟、同天 13 小时带日期、旧缓存与时间戳不一致以时间戳为准、异常区间清空、onHidden 不覆盖、onVisible 更新 end、四选项结算一致；脚本已删除。

## Stage 8 验收（PWA 基础）

| # | 要求 | 现状 |
| --- | --- | --- |
| 1 | 新增 `manifest.webmanifest` | ✅ name/short_name/`id`(`./`)/start_url(`./index.html`)/scope(`./`)/display(standalone)/theme_color/background_color/icons |
| 2 | 新增 192×192 与 512×512 图标 | ✅ `icons/icon-192.png`、`icons/icon-512.png`，另含 `icons/maskable-512.png`（纯 Node 零依赖生成，无外部下载） |
| 3 | 新增 `service-worker.js` | ✅ install 预缓存 / activate 清旧缓存 / fetch 拦截 |
| 4 | 缓存 index.html、styles.css、app.js、图标与必要静态资源 | ✅ `PRECACHE_URLS` 含 `./`/`index.html`/`styles.css`/`app.js`/`manifest.webmanifest`/三个图标 |
| 5 | Service Worker 只在 http 或 https 下注册 | ✅ `registerServiceWorker` 判断 `location.protocol === "http:"/"https:"`，否则直接 return |
| 6 | file:// 直接打开必须继续正常，不报错不白屏 | ✅ 注册/安装逻辑均包裹 try/catch + 协议判断；file:// 下不注册 SW、安装面板隐藏；manifest/图标 link 失效不阻断应用 |
| 7 | 缓存使用明确版本号，更新后能获取新文件 | ✅ `CACHE_VERSION = "blockflow-v1"`，改版本号即触发新缓存并在 activate 清理旧缓存 |
| 8 | 清理旧缓存不能删除 blockflow.v1 任务数据 | ✅ 仅删 `blockflow-static-` 前缀缓存；SW 中无任何 localStorage 调用（Cache Storage 与 localStorage 两套独立） |
| 9 | 可选「安装到桌面」按钮；不支持或 file:// 下隐藏 | ✅ 设置页 `#pwaPanel`，`beforeinstallprompt` 触发才显示 `#installAppBtn`；非 http(s) 或不支持 SW 时整块隐藏 |
| 10 | 断网后重开页面，骨架与本地任务数据仍可读取 | ✅ 导航请求离线回退缓存 `index.html`；任务数据在 localStorage，离线不受影响（**需真实 http 环境实测，见下方未执行项**） |
| 11 | 不请求外部字体、图片或脚本 | ✅ 静态校验：html/css/js/manifest 中无任何 `http(s)://` 外部引用 |
| 12 | 不增加账号、支付、云同步和 AI API | ✅ 无网络写操作、无第三方 SDK |

**验收测试执行状态**（2026-10-04 更新：用户已在 `http://localhost:8080` 完成离线实测）：

| 测试 | 状态 |
| --- | --- |
| file:// 直接打开正常 | ⚠️ 未执行（内置浏览器不支持 `file://`）— 逻辑上由协议判断 + try/catch 保证 |
| http://localhost 下 Service Worker 注册成功 | ✅ **已通过（用户实测）**：`http://localhost:8080` 下 SW 已 `activated` |
| 断网后能够加载应用 | ✅ **已通过（用户实测）**：离线刷新后页面骨架仍正常加载 |
| 任务数据刷新后不丢失 | ✅ **已通过（用户实测）**：离线刷新后本地任务数据正常读取（`blockflow.v1`） |
| 修改缓存版本后能够获取新文件 | ⚠️ 未执行（人工可验证）— 静态逻辑成立（`CACHE_VERSION` 变更 → 新缓存名 → activate 清旧） |
| Console 没有红色报错 | ⚠️ 未执行 — 静态层面无外部引用、SW 逻辑 try/catch |
| Stage 7 的离开确认仍然正常 | ✅ 关键函数（`onVisible`/`ensurePendingGap`/`leaveCountAll`/`leavePauseFromAway`/`fmtLeaveSpan`）逐一确认仍在，未改动 |

> 说明：**离线能力已在真实 http 环境实测通过**（SW 注册 activated、断网刷新骨架与本地数据均正常）。以下仍属未验证项：(1) `file://` 直接打开（内置浏览器不支持，需用户双击验证）；(2) 修改 `CACHE_VERSION` 后获取新文件（人工可验证）；(3) F12 控制台无红色报错（人工可验证）。静态/逻辑级校验见「测试结果」。

本阶段代码改动（增量，未重写、未改排期/复盘/离开确认核心）：

- 新增 `manifest.webmanifest`：应用元信息、固定 `id`(`./`) 与三个图标（含 maskable），相对路径，无外部资源；未伪造应用截图（`screenshots` 留空以保证基本 Manifest 可用）。
- 新增 `service-worker.js`：`CACHE_VERSION="blockflow-v1"`；`install` 预缓存核心静态资源（`cache.add` 单项失败不影响整体）；`activate` 仅清理 `blockflow-static-` 前缀旧缓存并 `clients.claim()`；`fetch` 对同源 GET 导航请求网络优先、失败回退缓存 `index.html`，静态资源缓存优先并回填；不触碰 localStorage。
- 新增 `icons/icon-192.png`、`icons/icon-512.png`、`icons/maskable-512.png`（纯 Node zlib 手写 PNG 生成，主题色渐变 + 时钟图形；生成脚本用后删除）。
- `index.html`
  - `<head>` 新增 `manifest`、`icon`、`apple-touch-icon` 及 iOS `apple-mobile-web-app-*` meta；将 `apple-mobile-web-app-capable` 补充为标准的 `mobile-web-app-capable`（并保留 Apple 兼容标签）。
  - 设置视图末尾新增 `#pwaPanel` 面板（`#installAppBtn` 默认 `hidden`、`#installHint`）。
- `app.js`
  - 新增 `registerServiceWorker()`：仅 http/https 注册，其余安全跳过，失败静默不报红。
  - 新增 `setupInstallPrompt()`：`beforeinstallprompt` 捕获并 `preventDefault`，显示安装按钮；`appinstalled` 隐藏并提示；非 http(s)/不支持 SW 时隐藏面板；点击调用 `prompt()` 并按 `userChoice` 提示。
  - `init()` 末尾调用 `setupInstallPrompt()` 与 `registerServiceWorker()`（在离开区间恢复逻辑之后）。
- `styles.css`
  - 末尾追加「Stage 8」小块：`#pwaPanel .btn-row` 换行与 `#installHint` 自适应宽度。
- 未改动：Stage 4 排期引擎、Stage 5 复盘/历史、Stage 6 响应式/可访问性、Stage 7 后台计时与离开确认。

## Stage 9 验收（全量验收、比赛演示与提交封版）

| # | 要求 | 现状 |
| --- | --- | --- |
| 1 | 增加「导出数据」按钮，导出为 JSON | ✅ `exportData()`：Blob 下载 `blockflow-backup-*.json`，含 `{app, storageKey, exportedAt, data}` 元信息 |
| 2 | 增加「导入数据」按钮，导入前校验格式 | ✅ `importData()` 前置校验 JSON 合法性与 `days`/`settings` 结构，非法即拒绝 |
| 3 | 导入成功后刷新页面状态 | ✅ `initViewAfterImport()`：重置运行态、切「今日」、`render()` |
| 4 | 导入失败必须显示原因，不能覆盖现有数据 | ✅ 校验在覆盖前完成，失败仅提示、`state.data` 不变；覆盖前写 `blockflow.v1.bak` 回滚点 |
| 5 | 清空全部数据前二次确认 | ✅ `window.confirm("确定清空全部数据…")` |
| 6 | 恢复示例数据前二次确认 | ✅ `window.confirm("载入示例数据…")` |
| 7 | 不使用云端上传 | ✅ 无 `fetch`/`XHR`/`sendBeacon`；导入导出均本地 |
| 8 | 90 秒演示脚本 | ✅ 重写 `docs/demo-script.md`（9 步时间轴 + 60 秒精简版） |
| 9 | 最终验收清单与真实结果 | ✅ 新增 `docs/final-checklist.md`（区分已执行 / 未执行） |
| 10 | 架构说明 | ✅ 新增 `docs/architecture.md` |
| 11 | 提交文件清单 | ✅ 新增 `docs/submission-package.md` |
| 12 | 已知限制 | ✅ 新增 `docs/known-limitations.md` |
| 13 | README 运行/安装/测试说明 | ✅ 更新特性、文档索引、测试章节 §10 |
| 14 | 封版不改核心 | ✅ 未改排期/复盘/计时/离开确认/PWA |

**Stage 9 代码改动（增量）**：

- `index.html`：数据面板新增 `#exportDataBtn`/`#importDataBtn`/`#importFile`(hidden)/`#dataHint`，按钮行改为 `btn-row wrap`。
- `app.js`：新增 `exportData`/`pickImportFile`/`looksLikeData`/`importData`/`importDataFromFile`/`initViewAfterImport`；`bind()` 增三处事件绑定。
- `styles.css`：末尾追加 Stage 9 小块（`#dataHint` 间距、`#importFile` 隐藏）。
- 修复：`exportData` 内局部 `pad` 与顶层 `pad` 重名，改为复用顶层 `pad`（防静默覆盖）。

**Stage 9 验收测试执行状态**：

| 测试 | 状态 |
| --- | --- |
| 导出 JSON / 导入校验 / 导入后刷新 / 失败不覆盖 / 二次确认 | ✅ 静态逻辑通过（17/0 PASS）；⚠️ 运行时操作未执行 |
| PWA 离线（SW 注册、离线刷新、数据保留） | ✅ **已通过（用户实测，`http://localhost:8080`）** |
| 最终功能验收 §一 18 项 | ⚠️ 除 PWA 相关外的运行时项目未在本机执行，详见 `docs/final-checklist.md` |

> 说明：本阶段为封版，**所有未在本机运行的测试在 `docs/final-checklist.md` 中明确标记为「未执行」，不声称通过**。已完成的是静态/逻辑级校验与 PWA 离线实测。

## 已知缺口（待后续阶段，详见 decisions.md）

- D-07 容量上限：✅ Stage 4 已实现。
- D-08 离开超时未提供「是否计入任务」选择：✅ Stage 7 已实现（见 D-24）。
- D-09 进度备注与「下次继续位置」：✅ Stage 5 已实现。
- D-10 突发重排与「缩短/顺延/调整」方案：✅ Stage 4 已实现。
- 跨夜任务的 `overflow` 顺延仅支持「移到次日」，未提供指定日期选择。
- 复盘卡片未提供单条备注删除入口（可后续按需补充）。

## 运行方式

- 双击 `index.html` 直接用浏览器打开（推荐，`file://` 可用）。
- 或使用本地静态服务：`python -m http.server 8080` 后访问 `http://localhost:8080/`。

## 测试结果

- 已执行（静态/逻辑级）：
  - `node --check app.js` 语法校验通过。
  - DOM id 完整性：`app.js` 通过 `$()` 引用 **112 个** id，`index.html` 中**缺失 0 个**。
  - 临时 node 脚本（vm 沙箱注入 app.js 内部函数）跑 12 项断言，**12 通过 / 0 失败**：
    - 状态归类：英语 180/2min→`early`；30min 待开始→`pending`；60/60→`ontime`；60/90→`over`；进行中/暂停原样；
    - `interruptMinutes`：多条中断累加、进行中按当前时间计；
    - `reviewFilterMatch`：五种筛选全组合；
    - `historyDates` 倒序 + `daySummary` 计划/实际/完成率；
    - `renderReview`/`renderHistory`/`renderHistoryDetail` 有数据与空数据冒烟（不抛异常且有内容）。
  - 临时脚本已删除（`_check_ids.js`、`_check_logic.js`）。
  - **Stage 5 收尾修复**（`_check_fix.js`，vm 沙箱，**21 通过 / 0 失败**，脚本已删除）：
    - `splitDurations` 英文/中文逗号、顿号、中英文分号、换行、连续空格、混合分隔符、全角数字、空输入全部正确；
    - `resolveDuration` 全角数字、带「分钟」后缀、留空自动估时、非法值报错含具体值、小于 5 报错；
    - `formatTimeRange` 输出「21:31 – 22:16 · 45 分钟」、无 slot 空串、无 duration 仅范围；
    - 端到端：读书/看报/写字 + `30, 60, 90` 一次添加成功，时长 30/60/90，输入清空，数据落库；
    - `renderToday` 时间线含规范 `<span class="tl-dur">HH:MM – HH:MM · N 分钟</span>`，且无 `HH:MMNm` 粘连。
  - **Stage 6**（`_check_stage6.js`，vm 沙箱，**15 通过 / 0 失败**，脚本已删除）：
    - DOM id 完整性：`app.js` 通过 `$()` 引用 **112 个** id，`index.html` 中**缺失 0 个**；
    - 时长解析回归（未回退 Stage 5）：全角+「分钟」、半角+「分」、零宽字符、带空格、非法值、留空估时均正确；
    - 批量拆分：中英逗号/顿号/分号/换行/连续空格/全角数字全部正确；
    - 排期引擎回归（未回退 Stage 4）：两自由任务无重叠且含 5 分钟缓冲、固定段锁定 10:00–11:00、固定任务超出部分补排（`isExtension`）、`fixedConflict` 与午餐冲突命中/无冲突返回 null。
  - **Stage 7**（`_check_stage7.js`，vm 沙箱 + 可控时钟，**20 通过 / 0 失败**，脚本已删除）：
    - 阈值：离开 3 分钟（180s）≤ 5 分钟（300s）不弹窗（验收 2）；
    - 全部计入：`actual 120→168` 分钟、增加 48（离开前段 10 + 离开 38）、记 `counted=true` 中断、`pendingGap` 清空（验收 3/4）；
    - 全部不计入：`actual` 保持 120、剩余 60 分钟、记 `counted=false` 中断（验收 5）；
    - 只计入 10 分钟：`actual 120→130`、中断含「部分计入/未计入」（验收 6）；
    - 从离开时暂停：`status=paused`、`startedAt=null`、`interruptedAt=离开开始`、保留离开前实际用时 130（验收 7）；
    - 异常安全：`safeSeconds(-5/NaN)=0`、反向区间 `secondsBetween=0`、阈值钳制（99→60、0→5）；
    - 确认后所有任务 `pendingGap` 清空（验收 10）。
  - 持久化恢复（read-only 复核）：`normalize` 保留 `pendingGap*` 字段、`init` 先取 `activeId` 再扫描全部任务恢复 → 验收 8 路径成立；`load()` 由 `normalize` 兜底包 `try/catch` + 损坏可见提示。
  - 修复记录：`leavePauseFromAway` 原用 `actual -= (startedAt→离开)` 与 `pauseTask` 语义（`actual += 该段`）相反，会导致实际用时被倒扣；已统一为 `+=`（见 D-24）。
  - **Stage 7 时间区间修复**（`_check_leave_fix.js`，vm 沙箱 + 可控时钟，**22 通过 / 0 失败**，脚本已删除）：同天 16 分钟（标题/区间一致）、跨天 9 小时 52 分钟、同天 13 小时两端带日期、旧缓存与时间戳不一致以时间戳重算为准、`end<=start` 异常清空、`onHidden` 不覆盖未确认区间且开新区间清旧值、`onVisible` 更新 `pendingGapEnd` 后重算、四选项结算与弹窗同口径。
  - **Stage 8 PWA**（`_check_pwa.js` 静态/逻辑校验，**22 通过 / 0 失败**，脚本已删除；`node --check app.js` 与 `node --check service-worker.js` 均通过）：
    - manifest 合法 JSON、含 name/short_name、`start_url` 为相对路径、`display=standalone`、含 192×192 与 512×512 图标；
    - 三个 PNG 图标存在且魔数正确（`89 50 4E 47`）；
    - SW 预缓存清单中的文件全部存在；`index.html` 引用的本地资源全部存在；html/css/js/manifest 中**无任何外部 `http(s)://` 引用**；
    - SW 注册受 `location.protocol` 限制（仅 http/https）；`CACHE_VERSION` 常量存在；清缓存仅限 `blockflow-static-` 前缀；SW **无 localStorage 调用**；
    - `registerServiceWorker`/`setupInstallPrompt` 存在；新增 DOM id（`pwaPanel`/`installAppBtn`/`installHint`）齐全，全量 `$()` 引用缺失 0；无重名函数定义。
  - **Stage 9 数据安全与封版**（临时静态/沙箱校验脚本，**17 通过 / 0 失败**，脚本已删除；`node --check app.js` 与 `node --check service-worker.js` 均通过）：
    - 数据面板新 id（`exportDataBtn`/`importDataBtn`/`importFile`/`dataHint`）齐全，全量 `$()` 引用缺失 0；无重名函数定义（修复 `pad` 重名隐患）；
    - `exportData`/`importData`/`importDataFromFile`/`pickImportFile`/`looksLikeData`/`initViewAfterImport` 均存在；
    - 三处二次确认（清空全部数据 / 载入示例数据 / 导入覆盖）存在；无 `fetch`/`XHR`/`sendBeacon` 等网络上传调用；`app.js` 可在最小 vm 沙箱加载。
- 未执行：浏览器端功能回归与 F12 控制台实测（内置浏览器不支持 `file://`）。**PWA 离线部分已在 `http://localhost:8080` 实测通过**。其余运行时项目请按 `docs/final-checklist.md` 与下方清单验证；未执行项一律标记「未执行」，不声称通过。

### Stage 9 用户自测清单（数据导入 / 导出）

1. 设置页「数据」面板点「导出数据」：下载 `blockflow-backup-*.json`，内联提示与 Toast 均显示成功。
2. 点「清空全部数据」：出现二次确认，确认后清空并提示。
3. 点「导入数据」选择刚导出文件：出现覆盖二次确认，确认后数据恢复、页面切「今日」，提示「导入成功」。
4. 导入非法文件（非 JSON 或字段缺失）：显示「导入失败：…（现有数据未改动）」红色提示并滚动可见，数据不变。
5. 导入失败后刷新：原有数据仍完整。

### Stage 8 用户自测清单（请在真实浏览器 / 本地服务执行）

> ✅ 已验证（用户实测）：`python -m http.server 8080` 后访问 `http://localhost:8080/`，SW 已 `activated`，断网刷新后页面与本地任务数据均正常。
> 以下为**待用户执行/复核**：
1. file:// 直接双击 `index.html`：页面正常显示、五页可切换、无白屏；Console 无红色 JS 报错（manifest 加载告警可忽略）；设置页「安装到桌面」面板已隐藏。
2. http://localhost:8080/ ：DevTools → Application → Service Workers 显示 `service-worker.js` 状态 `activated`；Cache Storage 出现 `blockflow-static-blockflow-v1`，内含 index.html/styles.css/app.js/manifest 与图标。
3. DevTools → Network 勾选 Offline 后刷新：页面骨架仍能加载，本地任务数据仍在。
4. 正常联网下新增/修改任务并刷新：数据不丢失（`blockflow.v1`）。
5. Application → Cache Storage 删除缓存或把 `CACHE_VERSION` 改为 `blockflow-v2` 后刷新：旧缓存被清理、新缓存建立，页面加载最新文件。
6. 支持安装的浏览器（Chrome/Edge）地址栏出现安装图标、设置页「安装到桌面」按钮出现；点击可弹出安装提示。
7. 回归：执行页开始任务 → 切后台/锁屏超过阈值返回 → 离开确认弹窗与四选项仍正常（Stage 7）。

### Stage 7 用户自测清单（请在真实浏览器执行）
1. 英语目标 180、完成 120 分钟后，切到其他 App/锁屏 3 分钟返回：不弹窗，计时继续。
2. 上述状态离开 38 分钟返回：弹窗「你离开了 38 分钟，这段时间算入「英语」吗？」。
3. 选「全部计入」：已用 120→168 分钟，剩余显示 12 分钟，中断记录标「计入」。
4. 选「全部不计入」：已用保持 120，剩余 60 分钟，中断标「不计入」，后续任务重新排期。
5. 选「只计入一部分」输入 10：已用 120→130，中断显示「部分计入 10 / 未计入 28」。
6. 选「从离开时暂停」：任务变「已暂停」，继续后从暂停点恢复。
7. 关闭标签页再打开：未确认的离开弹窗自动恢复；已确认过的不再重复弹出。
8. 开始/暂停/继续/完成/复盘功能与 Stage 4–6 行为不受影响。

## 下一阶段依赖

- **项目已封版（Stage 9）**：不再新增非必要功能；如无新需求不再开发。
- 若继续迭代，必须先读本文件与 `docs/decisions.md`、`docs/scheduling-rules.md`、`docs/data-model.md`、`docs/architecture.md`。
- 保持纯静态零依赖、localStorage 兼容、失败可见三条约束。
- 不得回退 Stage 4（排期引擎）、Stage 5（历史/复盘/备注）、Stage 6（响应式/可访问性）、Stage 7（后台计时/离开确认）、Stage 8（PWA）、Stage 9（数据导入导出）已验收行为；不得引入学习/健身建议、后端、账号、云同步。
- 阶段完成后更新本文件并输出 TIMEBLOCK HANDOFF。

## 给下一位智能体的上下文摘要

Stage 4 建立了统一自动排期引擎：`scheduleForDate` 为唯一入口，`computeSlots` 先锁睡眠（容量窗口 `dayWindow`）、吃饭、固定占用、固定任务（含目标超时段自动补排），再排偏好后自由任务，任务间保留 5–10 分钟缓冲（`bufferMinutes`），不排到过去（`earliestMinute`），超容量登记 `overflow` 而非删除任务；`replanRemaining` 只重排未完成且非固定任务；时间不足时 `shortageOptions` 给出缩短/顺延/调整方案，用户点选才应用。

Stage 5 在复盘维度做了增强且未触碰排期核心：`renderReview` 输出八项统计（计划/实际总时长、完成率、计划偏差、中断次数、中断总时长、顺延总时长、完成任务数）与状态分布、完成率条；卡片状态由 `reviewStatusKind(status,duration,actualSec)` 单点判定为 `over(>1.1)/early(<0.9)/ontime`，`reviewCard` 据此渲染徽章、时长差与独立进度条（目标条固定 100%、实际条封顶 100%、超时用 `--danger`）。筛选 `reviewFilter ∈ {all,done,undone,interrupt,delayed}` 由 `reviewFilterMatch` 判定。历史记录由 `historyDates`（日期倒序）+ `daySummary` + `renderHistory`/`renderHistoryDetail` 构成，点击日期经 `setDate()` 切换。进度备注落地为 `task.notes`/`task.resumeFrom`（关闭 D-09），执行页 `saveRunNote` 读写，复盘与历史复用展示。渲染均在 `render()` 时重算，保证编辑/计时/备注后同步。

Stage 6 是纯表现层与交互可访问性打磨，**未改任何数据模型与排期/复盘逻辑**：`index.html` 增加 skip link、`role="tabpanel"`、tab 的 `aria-controls`/`aria-selected`、弹窗 `.modal-head`（含关闭按钮）、hint 的 `role="status" aria-live`、筛选 `aria-pressed`；`app.js` 新增 `showModal`/`hideModal`/`focusables`/`trapFocus` 实现弹窗开关注焦、Tab 焦点陷阱与关闭回落触发元素，并为规则表/固定占用动态按钮与输入补 `aria-label`；`styles.css` 末尾追加 Stage 6 块，含防横向溢出、`overflow-wrap:anywhere` 长标题换行、`.skip-link`、`:focus-visible` 强焦点、错误/成功非纯色提示（border-left + `::before` 图标）、触控尺寸、`.modal-head` sticky、底部安全区、320/375-430/768/1200 四档断点、`prefers-reduced-motion` 全局降级与深色模式对比度补丁。

Stage 7 关闭 D-08（离开是否计入任务）并建立「后台计时/离开确认」模型，**未改排期/复盘核心，仅新增钩子**：核心是**不依赖 `setInterval` 的 `Date.now()` 时间戳恢复**——Task 增 `lastVisibleAt`/`pendingGapStart`/`pendingGapEnd`/`pendingGapSeconds`，`onHidden`（`visibilitychange hidden`/`pagehide`/`beforeunload`）记录离开起点，`onVisible`（`visibilitychange visible`/`pageshow`）用 `secondsBetween` 计算离开时长；默认阈值 5 分钟（设置页 1–60，`leaveThresholdMinutes` 钳制），未超阈值直接推进计时、超阈值建 pendingGap 并 `openLeaveModal`。四选项结算统一经 `leaveBase`（离开前真实工作 + 返回后真实时长，避免丢计时）：`leaveCountAll` 计入并记 `counted=true`；`leaveCountNone` 不计入、`startedAt=当前`、`replanRemaining` 重排、记 `counted=false`；`leaveCountPart` 按 0~离开分钟数只增指定时长；`leavePauseFromAway` 保留离开前用时、`status=paused`、`startedAt=null`、`interruptedAt=离开开始`、重新排期。`normalize` 保留 pendingGap 字段、`init` 扫描 `activeId`/全部任务恢复未确认区间；确认后一律 `clearPendingGap` 防重复扣除；`safeSeconds`/`secondsBetween` 对负数/NaN/超范围/反向区间安全回退。修复：`leavePauseFromAway` 原用 `actual -=`（与 `pauseTask` 的 `+=` 语义相反）会倒扣用时，已统一。D-08 已关闭。

Stage 8 在保持 `file://` 直开与纯静态零依赖的前提下补齐 PWA 基础（D-26）：`manifest.webmanifest`（固定 `id`/`start_url`/`scope`、三个图标）+ `service-worker.js`（`CACHE_VERSION="blockflow-v1"`，install 预缓存、activate 仅清 `blockflow-static-` 前缀旧缓存、fetch 导航网络优先离线回退 `index.html`、静态资源缓存优先回填，仅同源 GET）+ `icons/` 三个 PNG（纯 Node 生成）。`registerServiceWorker` 仅 http/https 注册，`setupInstallPrompt` 由 `beforeinstallprompt` 驱动显示安装按钮，非 http(s)/不支持则隐藏面板；SW 只用 Cache Storage，绝不触碰 localStorage。**离线能力已在 `http://localhost:8080` 实测通过**（SW activated、断网刷新骨架与本地数据正常）。

Stage 9 为最终封版（D-27），仅新增数据安全与交付文档、**未改任何已验收核心**：设置页「数据」面板新增「导出数据」（Blob 下载本地 JSON，含 `{app,storageKey,exportedAt,data}`）与「导入数据」（`importData` 前置校验 JSON 与 `days`/`settings` 结构 → 覆盖前二次确认 → 覆盖前写 `blockflow.v1.bak` → `initViewAfterImport` 切回今日刷新）；导入失败显示原因且不覆盖原数据；清空/载入示例均有二次确认；全程无云端。新增/重写文档：`docs/demo-script.md`（90 秒）、`docs/architecture.md`、`docs/final-checklist.md`、`docs/known-limitations.md`、`docs/submission-package.md`，并更新 README 与 roadmap/decisions/handoff。**项目已封版**，等待用户下达新需求才继续。