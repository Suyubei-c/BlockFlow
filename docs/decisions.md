# 时块 BlockFlow · 关键决策记录（Decisions）

> 只记录「为什么这么定」，不重复描述功能本身。新增决策请追加编号，不修改历史结论。
> 若发现前序设计问题，在此登记，不静默改变整体方向。

## D-01 技术形态：纯静态零依赖

- **决策**：仅用 HTML5 + CSS3 + 原生 JS(ES6) + localStorage，不使用 npm/框架/后端/数据库。
- **原因**：用户要求双击 `index.html` 即可运行、离线可用、不依赖服务器或容器。
- **影响**：所有能力必须在浏览器本地实现；不得引入构建步骤；PWA 只能是可选增强。

## D-02 数据持久化：单一键 `blockflow.v1`

- **决策**：全部状态（settings + days + activeId）写入单个 localStorage 键。
- **原因**：结构简单、便于整体读写与备份；避免多键不一致。
- **影响**：写入失败（隐私模式/配额满）必须可见提示；损坏时回退示例数据并告知用户。

## D-03 任务存储按日期分桶

- **决策**：`days["YYYY-MM-DD"] = Task[]`，任务归属其日期桶。
- **原因**：按天渲染与统计最直接；固定任务通过 `fixedDate` 与重复规则跨日期生效。
- **影响**：`collectTasks(dateKey)` 需合并「当天自有任务」与「当天生效的固定任务」并去重。

## D-04 固定时间优先且不可覆盖

- **决策**：固定时段是硬约束，其他任务必须避让；冲突时拒绝写入并提示，不自动覆盖。
- **原因**：产品红线第 8 条；用户明确要求冲突必须可见而非静默处理。
- **影响**：`fixedConflict` 在新增/编辑时校验三餐与已有固定任务；提示同时出现在内联提示与 Toast。

## D-05 固定任务保留目标时长，超出部分补排

- **决策**：固定任务先占 `min(固定时长, 目标时长)`，超出部分生成 `isExtension` 补排段。
- **原因**：固定时段可能短于目标时长（如英语 3 小时但只有 15:00–17:00）。
- **影响**：时间线需展示「固定」与「剩余安排」两段。

## D-06 安排方式三态 + 旧数据兼容

- **决策**：`mode` 取 free/preferred/fixed；缺字段按 free，fixed 缺时间则回退 free。
- **原因**：增量演进，不能让旧数据报错或白屏。
- **影响**：`normalize` 是唯一的兼容入口，所有读取都经过它。

## D-07 发现：非固定任务排布缺少容量上限检查 — ✅ 已解决（D-20）

- **问题**：`computeSlots` 第 3 步对非固定任务未做 `start + duration > cap` 判断，任务多时可能排到入睡时间之后。
- **原因**：早期实现优先保证「不重叠」，未处理容量溢出。
- **处理**：**Stage 4 已解决**：`computeSlots` 以 `dayWindow()` 的 `dayEnd` 为容量上限，排不下时记入 `overflow` 并提供缩短/顺延/调整方案（见 D-20）。修复未改变已完成任务与固定段。

## D-08 缺口：离开询问「是否计入任务」未实现 — ✅ 已解决（D-24）

- **问题**：`tick()` 只显示「离开 N 分钟」文案，未提供「计入/不计入」选择。
- **处理**：**Stage 7 已解决**：建立时间戳恢复 + 离开阈值 + 四选项确认流程（全部计入/不计入/部分计入/从离开时暂停），pendingGap 持久化并在重开后恢复（见 D-24）。

## D-09 缺口：进度备注与下次继续位置未落地 — ✅ 已解决（D-21）

- **问题**：数据模型已预留 `ProgressNote`，但 UI 与读写逻辑尚未实现。
- **处理**：**Stage 5 已解决**：执行页新增进度备注面板，落地 `task.notes: {text,at}[]` 与 `task.resumeFrom`，复盘与历史复用展示（见 D-21）。旧数据缺字段按空处理。

## D-10 缺口：突发重排与时间不足方案未实现 — ✅ 已解决（D-20）

- **问题**：目前无「重新安排剩余任务」入口，也无「缩短/顺延/调整」选择。
- **处理**：**Stage 4 已解决**：新增 `replanRemaining`（只重排未完成、不覆盖已完成）与 `shortageOptions`/`renderShortagePanel`（缩短/顺延/调整，用户点选才应用），见 D-20。

## D-11 缺口：自动估时未真正实现

- **问题**：未填时长时目前统一按默认 30 分钟，而非基于任务文本估算。
- **处理**：列入 Stage 1；估值规则集中在单一函数，界面标注「估算」，允许覆盖。

## D-12 失败必须可见（全局约定）

- **决策**：所有写数据操作包裹统一 `guard`/`try...catch`；失败同时给出内联提示与 Toast，并滚动到可见区域。
- **原因**：用户明确要求「不能静默失败」，且曾遇到点击无反应的困惑。
- **影响**：新增交互必须复用现有提示机制，不得用静默 `return` 吞掉错误。

## D-13 只重排未来，不推翻已完成

- **决策**：任何重排只作用于未完成任务；已完成任务及其 `actual` 冻结。
- **原因**：产品红线第 9 条。
- **影响**：排布算法需区分 `status === "done"` 的任务并保留其时间与进度。

## D-14 重复规则首版范围

- **决策**：首版支持 none/daily/weekdays/weekly，「自定义重复」列入后续。
- **原因**：控制首版复杂度，覆盖高频场景。
- **处理**：数据模型保留 `repeat` 字段，后续可扩展取值而不破坏兼容。
## D-15 阶段定义调整：Stage 1 = Web 骨架与本地存储

- **决策**：用户将 Stage 1 定义为「Web 骨架、页面和本地存储」，与最初 roadmap 中「自动估时」的划分不同；以用户下发为准。
- **原因**：现有原型已具备骨架能力，Stage 1 转为对骨架与 localStorage 五项要求的验证与小修。
- **影响**：原「自动估时」内容顺延为待定阶段（见 `roadmap.md`）；D-11 仍未完成。
## D-16 复盘任务卡片独立比例与状态判定

- **决策**：复盘每张卡片的目标条固定 100%，实际条按该任务自身目标计算 `min(actual/planned,100)`，不再使用全局 `maxMin`；完成态区分提前/按时/超时（实际超过目标 10% 以上为超时）。
- **原因**：原实现用全局最大值导致 30 分钟任务目标条过短、英语 2/180 被误判「按时」、待开始显示负时长差，用户无法直观判断是否达标。
- **影响**：顶部整体统计仍保留全局比例；卡片内独立比较；超时实际条使用 `--danger` 红色；`planned=0` 时进度 0% 不除零。
## D-17 Stage 2：自动估时、任意日期与自定义重复

- **决策**：任务时长留空时由 `estimateDuration` 按任务文本保守估算（关键词分类 + 长度加成，10–180 分钟，5 的倍数），用户填写则以用户值为准；新建页统一「安排日期」字段（今天/明天快捷 + 任意日期）供三种模式共用；重复规则改为 仅今天/每天/工作日/每周/自定义，自定义用 `repeatDays` 存星期集合。
- **原因**：Stage 2 要求覆盖自动估时、任意日期、自定义重复，原实现缺这三项（D-11、原仅固定模式有日期、仅四种重复）。
- **影响**：Task 新增 `estimated`、`repeatDays`，`repeat` 增加 `custom`；`normalize` 全部兼容旧数据；`fixedAppliesOn` 支持 custom；`readFixedForm("new")` 的日期字段由 `newFixedDate` 改为统一的 `newDate`。
## D-18 Stage 3：固定占用（上课 / 通勤等）可配置约束

- **决策**：设置页新增「固定占用」列表（`settings.fixedBlocks`），每条含 `label`、`start`、`end`、`days`（星期集合，空表示每天）；该日生效的固定占用并入 `busyOf` 与 `fixedConflict` 的占用集合，`computeSlots(tasks, dateKey)` 按日期取用，随日期切换生效。
- **原因**：Stage 3 要求把「上课 / 通勤」等周期性不可用时段作为可配置基础约束；原 busy 仅含睡眠边界 + 三餐 + 固定任务，无法表达这类固定外占，且固定任务冲突检测需覆盖这些占用。
- **影响**：`DEFAULT_SETTINGS` 增加 `fixedBlocks: []`；新增 `normalizeFixedBlocks` / `fixedBlocksOn(dateKey)`；`normalize` 兼容旧数据（缺字段回退 `[]`）；`addTasks` 固定冲突提示改为详细文案并引导「示例数据中同名任务请先删除」；`computeSlots` / `busyOf` / `fixedConflict` 全部参数化日期。localStorage 键与顶层结构不变。
## D-19 Stage 3.5：重复规则精简与时间规则表

- **决策**：
  1. 重复规则仅保留 仅今天 / 每天 / 工作日 / 自定义，「每周同一天」删除；星期勾选仅自定义时可见，其他规则下隐藏并清空；旧数据 `weekly` 迁移为 `custom`（`repeatDays` 取固定日期对应星期），无法迁移回退 `none`。
  2. 设置页新增「时间规则表」，集中管理所有固定 / 偏好任务，支持编辑（复用编辑弹窗，更新原任务）、替换任务（已有任务或新名称接管原固定 / 偏好时间，原任务回自由且不删除）、暂停 / 恢复规则、删除（二次确认）。
  3. 暂停通过 Task 新增 `rulePaused` 字段实现：暂停后不占用固定 / 偏好时间（`computeSlots` 判断加 `!t.rulePaused`），但任务本身保留、仍可执行。
- **原因**：用户要求简化重复规则避免「每周同一天」与自定义重复语义重叠；并提供统一的固定 / 偏好时间管理入口，避免只能回到「新建 / 今日」逐条修改。
- **影响**：`REPEAT_TEXT` 与 `fixedAppliesOn` 移除 `weekly`；两处重复 select 移除该选项；CSS 补 `.weekday-picker[hidden]{display:none!important}`；`normalize` 迁移 weekly 并补 `rulePaused`；规则表与新建 / 编辑弹窗共用同一份 `blockflow.v1` 数据，三处同步。localStorage 键与顶层结构不变。
## D-20 Stage 4：自动排期引擎（关闭 D-07、D-10）

- **决策**：
  1. 设 `scheduleForDate(dateKey)` 为唯一排期入口（`collectTasks` + `computeSlots` + 诊断），渲染一律消费其结果，保证界面时间线与实际排期一致。
  2. 定义容量窗口 `dayWindow()`（起床→入睡，跨夜 +1440）；`computeSlots` 先锁固定任务、并入三餐与固定占用，再按「偏好 → 自由」顺序排布，任务间保留 5–10 分钟缓冲（`bufferMinutes()` 钳制），不排到过去（`earliestMinute()`），超容量记入 `overflow` 而非删除任务。
  3. 固定任务主段占 `min(时段, 目标)`，超出部分 `findFreeSlot` 补排（`isExtension`）；找不到空档记 `overflow(kind:"fixed-extension")`。
  4. `replanRemaining(dateKey)` 只重排未完成且非固定任务（对齐 `planStart`），跳过 `status==="done"`；规则表编辑/替换/暂停/恢复/删除、设置变更、新增任务后均立即调用并 `save()`。
  5. 时间不足时 `shortageOptions` 生成缩短/顺延/调整方案，`renderShortagePanel` 渲染 `#shortagePanel`，用户点选后 `applyShortageOption` 才写入；不自动应用、不自动删改任务。
  6. 新排期逻辑只保留重复取值 `none/daily/weekdays/custom`，仅 `custom` 读 `repeatDays`；`normalize` 保留 `weekly → custom` 迁移分支。
  7. `fixedConflict` 与今日页统一使用 `isActiveFixed`（固定且未暂停规则），暂停规则的固定任务按普通任务参与排布。
- **原因**：Stage 4 要求建立可解释的自动排期引擎，锁定睡眠/吃饭/课程/固定任务，按序安排偏好与自由任务，加入缓冲、排除过去时间、不删任务不覆盖已完成，并在时间不足时给出可选方案；同时关闭 D-07（容量上限）与 D-10（重排与时间不足方案）。
- **影响**：`app.js` 新增 `dayWindow`/`bufferMinutes`/`earliestMinute`/`isActiveFixed`/`scheduleForDate`/`replanRemaining`/`shortageOptions`/`applyShortageOption`/`renderShortagePanel`，重写 `computeSlots`（返回含 `overflow` 的诊断对象）；`index.html` 增 `#shortagePanel`；`styles.css` 增 `.shortage-panel` 系列样式；`state._shortageOptions` 为运行时缓存不持久化；localStorage 键与顶层结构不变。验证：临时 vm 沙箱脚本 22/22 PASS，DOM id 引用缺失 0。## D-21 Stage 5：历史与复盘增强、进度备注（关闭 D-09）

- **决策**：
  1. 复盘统计固定为八项：计划总时长、实际总时长、完成率、计划偏差、中断次数、中断总时长、顺延总时长、完成任务数（已完成/总数）；另加状态分布（`revDist`）与全局完成率条（`revRateBar`，纯 CSS 宽度）。顶部整体比例与卡片独立比例并存。
  2. 卡片状态由 `reviewStatusKind(status, duration, actualSec)` 单一函数判定：非 done 原样返回 `pending/doing/paused`；done 按 `actual/planned` 细分为 `over`（>1.1）/`early`（<0.9）/`ontime`；`planned=0` 时不除零（实际 >0 记 over，否则 ontime）。`reviewCard` 依此渲染徽章与时长差（待开始不显示差值）。
  3. 进度条由 `barRow(label, minutes, pct, cls, over)` 渲染：目标条固定 100%，实际条按该卡片自身 `actual/planned`，超目标条仍保持 100% 且加 `.over`（`--danger`）色；右侧统一显示「N 分钟 · P%」。
  4. 复盘筛选 `reviewFilter ∈ {all, done, undone, interrupt, delayed}`，`reviewFilterMatch(t, filter)` 判定；筛选为空与无任务分别给不同空状态；筛选为运行时状态不持久化。
  5. 历史记录：`historyDates()` 取有任务日期并按 `YYYY-MM-DD` 字符串倒序；`daySummary(dateKey)` 汇总计划/实际/完成率/任务数；`renderHistory` 渲染 `#historyList`，点击 `button[data-date]` 委托调用 `setDate()` 切换日期；`renderHistoryDetail` 渲染当天完整任务（实际用时、中断、顺延、进度备注）。只读 localStorage，不上传。
  6. 进度备注落地为 Task 新增 `notes: {text,at}[]` 与 `resumeFrom: string`；`normalizeNotes` 归一化；`saveRunNote` 校验至少一项非空后才写入（避免空写污染内存）；执行页 / 复盘卡片 / 历史详情复用同一结构展示。
  7. 不改动自动排期核心算法（`computeSlots`/`scheduleForDate` 等）；复盘与历史仅消费 `collectTasks`/`scheduleForDate` 结果。
- **原因**：Stage 5 要求修复复盘进度条与状态判定（关闭 D-16 的落地缺口）、增强复盘统计、新增历史记录、筛选排序，并落地进度备注（关闭 D-09）；同时禁止引入图表库/网络/后端、禁止改动排期核心。
- **影响**：`app.js` 新增/重写 `reviewStatusKind`/`reviewCard`/`barRow`/`interruptMinutes`/`reviewFilterMatch`/`renderReview`/`daySummary`/`historyDates`/`renderHistory`/`renderHistoryDetail`/`normalizeNotes`/`renderRunNotes`/`renderNoteList`/`saveRunNote`；`normalize` 与 `baseTask` 增 `notes`/`resumeFrom`；`render()` 复盘分支增历史渲染；`bind()` 增 `reviewFilters` 委托、`historyList` 委托、`runNoteAddBtn`。`index.html` 复盘视图重构（八统计卡 + 筛选栏 + 历史面板 + 详情面板）、执行页增进度备注面板；`styles.css` 增 `.rate-bar*`/`.dist-*`/`.filter-*`/`.note-*`/`.history-*`/`.review-notes`/`.note-resume`。Task 新增两字段（`normalize` 兼容旧数据）；localStorage 键与顶层结构不变。验证：`node --check` 通过，DOM id 引用缺失 0，临时 vm 沙箱脚本 12/12 PASS（含四条验收状态、中断统计、五种筛选、历史倒序与三渲染冒烟）。

## D-22 Stage 5 收尾：批量时长健壮解析与时间线文字粘连修复

- **决策**：
  1. 批量目标时长解析不再只支持英文逗号：新增 `toHalfWidth`（全角→半角）+ `splitDurations`（按 `[,，、;；\s]+` 切分）+ `cleanDurationToken`（去空白/零宽字符、去「分钟/分/min/m」后缀）。`resolveDuration` 先归一化再校验，非法值错误文案带具体输入。
  2. 时间范围展示统一走 `formatTimeRange(slot, duration)`，输出「HH:MM – HH:MM · N 分钟」；无排期返回空串，界面显示「时间未安排」而非 `--`；禁止把结束时间与时长拼成相邻文本节点。
  3. `.tl-meta` 采用 flex + wrap + gap，时间范围/目标时长/剩余安排/状态标签各自独立成元素；无排期时 `tl-time` 显示「待排」。
  4. 新建页 `bulkInput`/`defaultDuration`/`bulkDurations` 任一 input 即清除旧错误提示（`clearNewError`）。
- **原因**：用户实测反馈（a）批量时长用中文标点或空格分隔时被当作非法整串报错，且错误未指出具体值；（b）时间线把结束时间与目标时长粘成 `21:31 – 22:1645m`。两者均为增量修复，不涉及排期算法。
- **影响**：`app.js` 新增 `toHalfWidth`/`cleanDurationToken`/`splitDurations`/`formatTimeRange`，改 `resolveDuration`/`addTasks`/`renderToday`（时间线与任务列表）/`bind`；`styles.css` 改 `.tl-meta` 并新增 `.tl-dur`/`.tl-noslot`。localStorage 键与顶层结构不变。验证：`node --check` 通过，临时 vm 沙箱脚本 21/21 PASS（含端到端三任务批量添加与时间线格式断言）。
## D-23 Stage 6：响应式断点与可访问性打磨

- **决策**：
  1. 响应式采用四档断点：`max-width:359px`（320 紧凑）、`360–767px`（375/430 移动）、`min-width:768px`（平板，主内容 `max-width:760px`）、`min-width:1200px`（大屏，主内容 `max-width:1080px` 居中、今日页双栏）。移动端优先，只做增量覆盖。
  2. 防横向溢出：`html,body{overflow-x:hidden}`，关键容器（`app-main`/`view`/`panel`/`timeline`/`rules-list` 等）加 `min-width:0`；长任务名 `overflow-wrap:anywhere; word-break:break-word`；`.task-actions`/`.fb-times`/`.field-row` 允许换行。
  3. 底部导航安全区：`.app-main` 底部 padding 叠加 `env(safe-area-inset-bottom)`，避免遮挡最后一张卡片。
  4. 弹窗：`.modal-card{max-height:88vh;overflow-y:auto}`，`.modal-head{position:sticky}` 使关闭按钮始终可见；`app.js` 新增 `focusables`/`trapFocus`/`showModal`/`hideModal`，实现打开聚焦首个可聚焦元素、Tab 焦点陷阱、Esc 关闭、关闭回落触发元素。
  5. 可访问性标签：body 顶部 skip link；视图 `role="tabpanel"`；底部 tab `aria-controls`/`aria-selected`；提示区 `role="status" aria-live="polite"`；复盘筛选 `aria-pressed`；规则表/固定占用动态按钮与输入补 `aria-label`。
  6. 错误/成功提示同时用文字 + 图标 + `border-left`，不单靠颜色；`:focus-visible` 3px outline；深色模式补丁保证对比度；`prefers-reduced-motion` 全局降级动画/过渡/平滑滚动。
  7. 触控目标：`.icon-btn` 44×44、`.btn min-height:44px` 等。
- **原因**：用户下发 Stage 6 需求，要求移动端到桌面端的响应式适配与键盘/读屏可访问性，面向移动端优先的纯前端应用。
- **影响**：`index.html`（skip link、tabpanel、tab aria、modal-head、hint aria-live、筛选 aria-pressed）；`app.js`（焦点管理函数 + `openEdit`/`openReplace`/`closeEdit`/`closeReplace`/`keydown` 改造 + `renderRules`/`renderFixedBlocks` aria + 筛选 aria-pressed 同步）；`styles.css` 末尾追加 Stage 6 块（约 160 行）。**未改数据模型与排期/复盘核心**，localStorage 键与顶层结构不变。验证：`node --check` 通过；DOM id 引用缺失 0；临时 vm 沙箱脚本 15/15 PASS（9 项时长解析 + 6 项排期/冲突回归）。
## D-24 Stage 7：后台计时与离开确认（关闭 D-08）

- **决策**：
  1. **时间戳恢复而非 setInterval**：Task 增 `lastVisibleAt`/`pendingGapStart`/`pendingGapEnd`/`pendingGapSeconds`；`onHidden`（`visibilitychange hidden`/`pagehide`/`beforeunload`）记录离开起点，`onVisible`（`visibilitychange visible`/`pageshow`）用 `Date.now()`+`secondsBetween` 计算离开时长。`setInterval` 仅用于刷新显示，时间计算一律基于时间戳，避免后台被节流导致漏秒。
  2. **离开阈值**：`DEFAULT_SETTINGS.leaveThreshold=5`（分钟），设置页可调 1–60（`leaveThresholdMinutes` 钳制，异常回退 5）；`awaySec<=threshold` 直接推进 `lastVisibleAt` 不弹窗，超阈值建 pendingGap 并 `openLeaveModal`。
  3. **重复弹窗与重复扣除防护**：`pendingGapStart` 兼作「离开起点探针」；`ensurePendingGap` 见 `state.leaveFlow.taskId===t.id` 直接返回，确认后一律 `clearPendingGap`，保证同一区间只弹一次、只结算一次。
  4. **四选项结算统一经 `leaveBase(t,gapStart,gapEnd)`**：`workedBefore = actual + (startedAt→gapStart)` 保留离开前真实工作，`sinceReturn = gapEnd→now` 保留返回后真实继续时长，并重置 `startedAt=now` 续计。
     - 全部计入：`actual = workedBefore + 离开区间 + sinceReturn`，记 `counted=true` 中断；
     - 全部不计入：`actual = workedBefore + sinceReturn`（不含离开区间），`startedAt=当前`，记 `counted=false`，`replanRemaining` 重排；
     - 只计入一部分：校验 0~离开分钟数，`actual = workedBefore + 指定分钟 + sinceReturn`，中断文案记实际计入/未计入；
     - 从离开时暂停：保留离开前用时、`status=paused`、`startedAt=null`、`interruptedAt=离开开始`，`replanRemaining` 重排。
  5. **持久化与恢复**：`normalize` 保留上述字段（`safeSeconds` 兜底），`init` 在渲染后先取 `activeId`、缺失时扫描全部任务恢复未确认 pendingGap。
  6. **异常安全**：新增 `MAX_SECONDS`/`safeSeconds`/`secondsBetween`，负数/NaN/超范围/反向区间一律回退 0（或封顶）；`ensurePendingGap` 遇 `end<=start` 清空区间。
- **原因**：Stage 7 要求修复 D-08：移动端锁屏/切后台时 `setInterval` 会被节流或暂停，必须用时间戳恢复真实用时；离开超过阈值需由用户选择是否计入，且选择要能跨刷新保留、不能重复扣除。
- **影响**：`app.js` 新增 `MAX_SECONDS`/`safeSeconds`/`secondsBetween`/`leaveThresholdMinutes`/`runningTask`/`taskRemainingMinutes`/`onHidden`/`onVisible`/`ensurePendingGap`/`clearPendingGap`/`recordLeaveInterrupt`/`openLeaveModal`/`leaveBase`/`leaveCountAll`/`leaveCountNone`/`leaveCountPart`/`leavePauseFromAway`/`closeLeaveFlow`/`dismissLeave`；`normalize`/`baseTask` 增 4 字段；`startTask`/`resumeTask`/`renderRun`/`renderInterrupts`/`bind`/`init` 增挂载点；`DEFAULT_SETTINGS.leaveThreshold` 15→5。`index.html` 增 `#leaveModal` 与 `runRemain`、设置页阈值 1–60；`styles.css` 追加 Stage 7 块（`.leave-options`/`.it-tag.counted|uncounted` 等）。**未改排期/复盘核心**，localStorage 键与顶层结构不变。验证：`node --check` 通过；DOM id 引用缺失 0；临时 vm 沙箱脚本（可控时钟）20/20 PASS，覆盖 11 项验收中的阈值不弹窗、全部计入、全部不计入、部分计入、从离开时暂停与异常回退。修复：`leavePauseFromAway` 原用 `actual -= (startedAt→离开)`，与 `pauseTask` 的 `actual += 该段` 语义相反会导致倒扣，已统一为 `+=`。
## D-25 Stage 7 修复：离开确认弹窗时间区间一致性

- **决策**：
  1. **单一时长来源**：弹窗标题与区间说明必须共用同一份由 `pendingGapStart`/`pendingGapEnd` 现算的 `gapSec`，`pendingGapSeconds` 仅作缓存且每次 start/end 变化后立即重算，禁止一处用缓存、一处用时间戳。
  2. **带日期格式化**：新增 `fmtDateTime(ts, withDate)`（`10月4日 22:08`，24 小时制）与 `sameDay(a,b)`；新增 `fmtLeaveSpan(seconds)` 输出人类可读时长（`16 分钟` / `9 小时 52 分钟`）。既有 `fmtDuration(min)` 接收**分钟**，为避免同名覆盖改变语义，新函数命名 `fmtLeaveSpan`。
  3. **区间显示规则**：同天 `10月4日 22:08 – 22:24（16 分钟）`；跨天 `10月4日 22:08 – 10月5日 08:00（9 小时 52 分钟）`；超过 12 小时两端均显示完整日期与总时长。
  4. **生命周期防护**：`onHidden` 不覆盖已有未确认 `pendingGapStart`，开新区间时同步清空旧 `pendingGapEnd`/`pendingGapSeconds`；`onVisible` 先用当前时间更新 `pendingGapEnd` 再重算；`end<=start` 或 `gapSec<=0` 一律清空异常区间。
  5. **结算同口径**：四个选项（全部计入/不计入/部分计入/从离开时暂停）统一复用 `state.leaveFlow` 中与弹窗相同的 `start`/`end`/`seconds`；确认后 `clearPendingGap`。`renderRun` 待确认文案亦按时间戳现算。
- **原因**：原实现标题用缓存 `pendingGapSeconds`、区间用 `fmtClock` 分别取值，导致「标题 16 分钟 vs 区间 22:08 – 08:00」不一致，且跨天只显示 `HH:mm` 无法判断真实区间。
- **影响**：仅 `app.js`（新增 `fmtDateTime`/`fmtLeaveSpan`/`sameDay`，改 `ensurePendingGap`/`openLeaveModal`/`onHidden`/`onVisible`/四结算/`renderRun`）；`index.html`/`styles.css` 未改。**未改排期/复盘核心**，localStorage 键与顶层结构不变。验证：`node --check` 通过；临时 vm 沙箱脚本 22/22 PASS（同天 16 分钟、跨天 9 小时 52 分钟、同天 13 小时带日期、缓存不一致以时间戳为准、异常清空、onHidden 不覆盖、onVisible 重算、四选项同口径）。
## D-26 Stage 8：PWA 基础作为可选增强，file:// 优先

- **决策**：
  1. PWA 定位为**可选增强**：`manifest.webmanifest` + `service-worker.js` + `icons/` 三件套，仅在 http/https 安全上下文生效；`file://` 直接打开仍是首选使用方式，不受影响。
  2. **SW 注册受协议限制**：`registerServiceWorker` 判断 `location.protocol` 为 `http:`/`https:` 才注册，否则直接返回；注册失败静默、不阻断应用、不报红。
  3. **缓存与数据隔离**：SW 只缓存静态资源（Cache Storage），**绝不触碰 localStorage**；`blockflow.v1` 任务数据始终由页面本地读写。清理旧缓存只按 `blockflow-static-` 前缀删除，与任务数据是两套独立存储，故清缓存不会丢数据。
  4. **显式版本号**：`CACHE_VERSION` 常量（当前 `blockflow-v1`）参与缓存名，改版本号即产生新缓存并在 `activate` 清理旧缓存，保证更新后能获取新文件。
  5. **离线策略**：导航请求网络优先、失败回退缓存 `index.html`（离线可打开骨架）；静态资源缓存优先并回填；仅处理同源 GET。
  6. **安装到桌面可选**：`beforeinstallprompt` 捕获后显示设置页 `#installAppBtn` 并 `preventDefault` 自行控制时机；不支持该事件、非 http(s) 或不支持 SW 时整块面板隐藏。
  7. **零外部资源**：不请求任何外部字体/图片/脚本，图标由纯 Node（zlib 手写 PNG）本地生成，生成脚本用后删除；不引入依赖、后端、账号、支付、云同步、AI API。
- **原因**：Stage 8 要求补齐 PWA 基础能力（manifest、图标、SW、离线、安装入口），同时**硬性要求 file:// 仍可正常使用**、清缓存不得删除任务数据、不得请求外部资源。PWA 与纯静态零依赖交付形态并不冲突，只要把 SW 限制在安全上下文并把数据留在 localStorage。

## D-27 Stage 9：数据导出 / 导入本地化，封版不改核心

- **决策**：
  1. **本地 JSON 导出**：设置页「数据」面板新增「导出数据」，用 `Blob` + `a.download` 生成 `blockflow-backup-YYYYMMDD-HHmm.json`，内容含 `{app, storageKey, exportedAt, data}` 元信息，便于人工核对与迁移；仅用 `URL.createObjectURL`，不发起任何网络请求。
  2. **覆盖式导入 + 前置校验**：导入前先 `JSON.parse` 并校验结构（`days` 必须为对象、`settings` 必须为对象、含 `days`/`settings`/`version` 之一），不合格**在覆盖前抛错**并显示原因，现有数据保持不变；兼容本应用导出的带 `data` 包装的格式。
  3. **导入也需二次确认**：校验通过后再弹「导入将覆盖当前全部数据」确认；覆盖前把当前数据写入 `blockflow.v1.bak` 作为回滚点（写入失败不阻断，仅作尽力备份）。
  4. **导入后刷新状态**：`initViewAfterImport()` 重置 `runId`、切回「今日」并 `render()`；因当前视图即设置页，事件绑定保持不变，无需重绑。
  5. **失败可见**：导出/导入所有异常路径均通过 `toast` + `#dataHint` 内联提示 + `scrollIntoViewSafe` 呈现，绝不静默；导入失败文案明确「现有数据未改动」。
  6. **命名冲突防护**：新增函数避免与既有全局同名——`exportData` 内曾误用局部 `pad`，检测到与顶层 `pad`（第 53 行）重名后改用顶层 `pad`，防止静默覆盖改变语义。
  7. **封版不改核心**：本阶段为最终封版，仅新增数据安全能力与文档；**不改动**排期（Stage 4）、复盘/历史（Stage 5）、响应式/可访问性（Stage 6）、计时/离开确认（Stage 7）、PWA（Stage 8）任何已验收行为。
- **原因**：封版要求补齐「数据安全」四项（导出、导入校验、导入后刷新、失败不覆盖）与两项二次确认，并把产品以可交付形态封版。导出/导入是纯本地操作，不违反「不上云、不引入后端/依赖」的硬约束。
- **影响**：`index.html` 数据面板新增 `#exportDataBtn`/`#importDataBtn`/`#importFile`/`#dataHint`；`app.js` 新增 `exportData`/`pickImportFile`/`looksLikeData`/`importData`/`importDataFromFile`/`initViewAfterImport`，并在 `bind()` 绑定事件；`styles.css` 追加 Stage 9 小块。**未改排期/复盘/计时/PWA 核心**，localStorage 键与顶层结构不变。验证：`node --check app.js` 与 `node --check service-worker.js` 通过；临时静态校验脚本 **17/0 PASS**（DOM id 契约缺失 0、新增 id 齐全、无重名函数、关键函数存在、三处二次确认、无网络调用、最小沙箱可加载）；脚本已删除。**运行时导入/导出与最终功能验收其余项未在本机执行，明确标记为未执行（详见 docs/final-checklist.md）。**
- **影响**：新增 `manifest.webmanifest`、`service-worker.js`、`icons/icon-192.png`、`icons/icon-512.png`、`icons/maskable-512.png`；`index.html` 增 manifest/图标/apple meta 与 `#pwaPanel`（安装按钮默认 `hidden`）；`app.js` 增 `registerServiceWorker`/`setupInstallPrompt` 并在 `init()` 末尾调用；`styles.css` 追加 Stage 8 小块。**未改排期/复盘/离开确认核心**，localStorage 键与顶层结构不变。验证：`node --check app.js`、`node --check service-worker.js` 均通过；临时静态校验脚本 22/22 PASS（manifest JSON 与字段、PNG 魔数、预缓存文件存在、无外部引用、协议限制、版本号与清除前缀、SW 无 localStorage 调用、DOM id 完整、无重名函数）；脚本已删除。**运行时测试（SW 注册、离线、安装、Console 无错）因本环境无法启动本地服务且内置浏览器不支持 file://，明确标记为未执行。**