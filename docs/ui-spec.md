# 时块 BlockFlow · 交互与界面规格（UI Spec）

> 版本：Stage 0 基线 · 对应现有原型（五视图 + 编辑弹窗 + Toast）

## 1. 设计原则

1. **移动端优先**：默认按手机竖屏设计，向上适配平板与桌面。
2. **状态可见**：任何按钮都有明确的可用/禁用/进行中状态；任何失败都有可见提示。
3. **失败必须可见**：错误提示要出现在用户当前视口能看到的区域，必要时自动滚动到提示处。
4. **数据本地**：界面明确告知数据保存在本机浏览器。
5. **零依赖**：仅用原生 HTML/CSS/JS，不引入任何 UI 库。

## 2. 信息架构

底部 5 个标签（Tab），单页切换：

| Tab | 视图 id | 作用 |
| --- | --- | --- |
| 今日 | `view-today` | 日期切换、汇总、时间线、任务列表 |
| 新建 | `view-new` | 批量/单个任务输入、安排方式、固定时间 |
| 执行 | `view-run` | 选择任务、计时、暂停/继续/中断/完成 |
| 复盘 | `view-review` | 计划 vs 实际、中断、顺延统计 |
| 设置 | `view-settings` | 作息、吃饭、缓冲与提醒、数据管理 |

另有全局组件：
- 顶部栏 `app-header`：品牌 + 「今天」快捷按钮 `todayPill`。
- 编辑弹窗 `editModal`：编辑已有任务。
- Toast `toast`：全局轻提示（`role="status"`、`aria-live="polite"`）。

## 3. 响应式规范

| 断点 | 布局 |
| --- | --- |
| < 640px（手机） | 单列布局；底部导航为通栏固定；卡片纵向排列。 |
| 640–959px（平板） | 内容区加宽；汇总卡片可 2–3 列。 |
| ≥ 960px（桌面） | 内容区限宽居中；底部导航变为居中悬浮胶囊。 |

- 基础字号、按钮点击区域满足触屏（≥ 44px 高）。
- 支持系统深色模式（`prefers-color-scheme`）。

## 4. 今日页（`view-today`）

1. 日期条 `date-bar`：前一天 `prevDay` / 日期标签 `dateLabel` + 星期 `dateWeek` / 后一天 `nextDay`。
2. 汇总卡片 `summary-grid`：
   - 计划时长 `sumPlan` + 任务数 `sumPlanCount`
   - 已完成 `sumDone` + 任务数 `sumDoneCount`
   - 剩余可用时间 `sumFree` + 提示 `sumFreeHint`（高亮样式 `accent`）
3. 时间线 `timeline`：
   - 按计划开始时间升序；每块显示时间范围与任务名。
   - 固定任务带「固定」标记；补排段显示「剩余安排 HH:MM–HH:MM」。
   - 已完成任务使用完成态样式（绿色）。
4. 任务列表 `taskList`：
   - 每项显示标题、时长、状态、安排方式、固定/补排信息。
   - 操作：编辑、删除、完成/恢复。
   - 计数 `taskCount`。

**空状态**：当天无任务时，时间线与列表显示空状态文案与引导。

## 5. 新建页（`view-new`）

1. 批量输入 `bulkInput`（textarea，每行一个任务）。
2. 安排方式 `newMode`：自由安排 / 偏好时间 / 固定时间，切换时联动显示对应子表单：
   - 自由：`newFreeBox`（计划开始时间 `defaultStart`）。
   - 偏好：`newPreferredBox`（偏好开始时间 `newPrefStart`）。
   - 固定：`newFixedBox`（开始 `newFixedStart` / 结束 `newFixedEnd` / 日期 `newFixedDate` / 重复 `newFixedRepeat`）。
3. 目标时长 `defaultDuration` 与批量时长 `bulkDurations`。
4. 主按钮：添加到当天 `addTasksBtn`；辅助：填充示例 `fillDemoBtn`。
5. 提示区 `newHint`：校验错误与冲突提示（`error` / `ok` 样式）。
6. 底部「添加说明」列表。

**交互约束**：
- 固定时间模式一次只能添加一个任务（固定时段无法批量占位）。
- 输入为空 / 时长非法 / 固定时段非法或冲突时，必须显示 `newHint` 错误并弹出 Toast，且**不写入数据**。
- 日期与时间统一 24 小时制。

## 6. 执行页（`view-run`）

1. 任务选择 `runTaskSelect`；当天无可执行任务时显示 `runEmpty`。
2. 执行卡片 `runCard`：
   - 状态 `runStatus`（待开始/进行中/已暂停/已完成 + 离开提醒）
   - 标题 `runTitle`、计时 `runTimer`（`HH:MM:SS`）
   - 元信息：目标 `runPlan`、已顺延 `runDelay`、中断 `runInterrupt`
   - 按钮：开始 `btnStart`、暂停 `btnPause`、继续 `btnResume`、记录中断 `btnBreak`、完成 `btnComplete`
3. 中断记录 `interruptList` + 计数 `interruptCount`。

**按钮状态规则**（同一时刻按任务状态启用/禁用）：
- 待开始：开始可用；暂停/继续/完成按需。
- 进行中：暂停、记录中断、完成可用。
- 已暂停：继续、完成可用。
- 已完成：仅可恢复（在任务列表）。

## 7. 复盘页（`view-review`）

1. 统计卡片：计划总时长 `revPlan`、实际总时长 `revActual`、中断次数 `revInterrupt`、顺延总时长 `revDelay`。
2. 逐任务列表 `reviewList`：计划/实际对比，偏差用条形 `barRow` 表示。
3. 空状态：无任务日期给出提示。

## 8. 设置页（`view-settings`）

1. 作息：入睡 `setSleepStart`、起床 `setSleepEnd`。
2. 吃饭：早 `setBreakfast`、午 `setLunch`、晚 `setDinner`、每餐时长 `setMealDuration`。
3. 缓冲与提醒：休息缓冲 `setBreakBuffer`、离开提醒阈值 `setLeaveThreshold`。
4. 保存 `saveSettingsBtn` / 恢复默认 `resetSettingsBtn`，提示区 `settingsHint`。
5. 数据：载入示例 `loadDemoBtn`、清空全部 `clearAllBtn`。

## 9. 编辑弹窗（`editModal`）

- 字段：名称 `editTitle`、安排方式 `editMode`、目标时长 `editDuration`、日期 `editDate`，以及随模式显示的自由/偏好/固定子表单。
- 提示区 `editHint`；保存时校验失败不得关闭弹窗。
- 支持 `Esc`、遮罩点击、取消按钮关闭且不修改数据。

## 10. 全局反馈规范（重要）

- **成功**：Toast（`ok`）提示，2.2 秒自动消失。
- **失败**：Toast（`error`）+ 页面内联提示（`newHint` / `editHint` / `settingsHint`），二者必须同时出现。
- **可见性**：失败提示若不在视口内，必须自动滚动到可见区域（`scrollIntoViewSafe`）。
- **兜底**：所有会写数据的操作统一包裹 `try/catch`（`guard`），异常时给出可见错误并且不改变数据。
- **空数据**：列表为空时显示引导文案，不显示空白。

## 11. 可访问性

- 标签页使用 `role="tablist"` / `role="tab"`，主区域使用 `aria-labelledby`。
- 弹窗使用 `role="dialog"` + `aria-modal="true"`。
- Toast 使用 `aria-live="polite"`。
- 图标按钮提供 `aria-label`。

## 12. 文案与语言

- 界面语言：简体中文。
- 时间统一 24 小时制，时长统一「分钟 / 小时」。
- 不使用任何领域性建议类文案（学习/健身/健康等）。