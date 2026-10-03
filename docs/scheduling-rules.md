# 时块 BlockFlow · 调度规则（Scheduling Rules）

> 版本：Stage 4 · 与 `app.js` 的 `scheduleForDate` / `computeSlots` / `findFreeSlot` / `fixedConflict` / `busyOf` / `replanRemaining` / `shortageOptions` 对应

## 1. 目标

给定某一天的任务集合，输出一组不重叠的时间块，明确「几点到几点做什么」，并遵守固定时间保护与已完成进度不可覆盖两条红线。

## 2. 分钟轴与容量

- 所有时间换算为「自 00:00 起的分钟数」（0–1440）参与计算，展示时再转回 `HH:MM`。
- 当天可用容量窗口 `dayWindow()`：
  - 起点 = `settings.sleepEnd`（起床）；
  - 终点 = `settings.sleepStart`（入睡）；
  - 若 `end ≤ start`，终点 +1440（跨夜）。
- `computeSlots` 返回 `dayStart` / `dayEnd` 作为容量边界；任务不会排在睡眠区间。
- 睡眠**不**作为 busy 段，而是通过容量边界排除。

## 2.1 不能排到过去 `earliestMinute(dateKey)`

- `dateKey === todayKey()`：返回当前时刻的分钟数（`now.getHours()*60 + now.getMinutes()`）。
- 其他（未来）日期：返回 0。
- 所有自由 / 偏好任务的起点与固定任务的补排段起点都不早于 `earliest`；固定段本身如实展示（即使早于当前时刻）。

## 3. busy 集合（不可占用）

`busyOf(fixed, dateKey)` = 固定任务时段 + 三餐 + 固定占用。

- **固定任务时段**：所有在该日生效的固定任务的 `[fixedStart, fixedEnd)`。
- **三餐**：`[breakfast, +mealDuration)`、`[lunch, +mealDuration)`、`[dinner, +mealDuration)`，仅当 `mealDuration > 0`。
- **固定占用**：`settings.fixedBlocks` 中该日生效的条目 `[start, end)`（`fixedBlocksOn(dateKey)` 按星期筛选，`days` 为空表示每天）。用于表达上课 / 通勤等周期性外占。
- `computeSlots(tasks, dateKey)` 与 `busyOf(fixed, dateKey)` / `fixedConflict(..., dateKey)` 均按 `dateKey` 取用当日固定占用，切换日期即切换约束。

## 4. 排布顺序（优先级）

`scheduleForDate(dateKey)` 为统一入口 = `collectTasks(dateKey)` + `computeSlots(tasks, dateKey)`，并附加 `dateKey` / `tasks` / `earliest`。

```
1) 固定任务优先锁定，进入 busy
2) 固定任务自身：占 min(固定时长, 目标时长)，超出部分补排到空档
3a) 偏好任务（soft 约束）先排
3b) 自由任务（含暂停规则的固定任务）再排
```

### 4.1 固定任务（第 1、2 步）

- 生效固定段判定 `isActiveFixed`：`isFixedTask` 且 `!rulePaused`。
- 合法固定段判定 `isFixedTask`：`mode === "fixed"` 且 `fixedStart`/`fixedEnd` 存在且 `end > start`。
- 固定段先放入 `fixed[]`，成为最高优先级占用。
- 任务自身主段占 `min(winLen, duration)`，`fixed: true`，`isExtension: false`：
  - `duration ≤ winLen`：只占目标时长，剩余固定时段不被该任务占用（但仍在 busy 中，其他任务也不能占用，因为它是固定时段）。
  - `duration > winLen`：先占满固定段，`rest = duration − winLen` 由 `findFreeSlot` 从 `max(固定段结束, earliest)` 向后寻找空档，生成 `isExtension: true` 的补排段，并把该段推入 `busy`。
  - 补排找不到空档：登记 `overflow`（`kind: "fixed-extension"`），**不删除任务**。

### 4.2 非固定任务（第 3 步）

- 起始点选择：
  - `preferred` 且有 `prefStart` → `parseMinutes(prefStart)`，标记 `soft: true`；
  - 否则 → `planStart` 的时间部分。
- 起点若早于 `earliest`，抬升到 `earliest`。
- 避让算法：`findFreeSlot(busy, from, duration, dayEnd)`。
- 结果段 `fixed: false`，并把 `[start, end + bufferMinutes())` 推入 `busy`，保证任务之间留出缓冲。
- 找不到空档：登记 `overflow`（`kind: "no-capacity"`），不排入时间线、不删任务。

### 4.3 缓冲 `bufferMinutes()`

- 缓冲统一钳制到 **5–10 分钟**：`breakBuffer <= 0` 或非数 → 5；`> 10` → 10；缺省 10。
- 缓冲只作用于非固定任务之间与固定任务的补排段之后；固定段本身前后不加缓冲（按设计如此）。
- `nextCursor`、`sumFree`、`addTasks` 的游标推进均使用 `bufferMinutes()`，保证界面与排期一致。

## 5. 空档查找 `findFreeSlot(busy, from, dur, cap)`

1. 令 `start = max(0, from)`。
2. 迭代：只要 `start` 与某 busy 段重叠，就把 `start` 后移到该段结束；重复直到稳定（上限 400 次防死循环）。
3. 若 `start + dur > cap`（或固定补排时超过 1440），返回 `null` 表示放不下。
4. 否则返回 `start`。

## 6. 冲突检测 `fixedConflict`

新增/编辑固定任务时校验，返回冲突文案（无冲突返回 `null`）：

1. **与三餐冲突**：`st < mealEnd && en > mealStart` → `与午餐（12:00–12:40）冲突`。
2. **与已有固定任务冲突**：与其他 `fixed` 任务时段重叠（排除自身 `excludeId`）→ `与固定任务「英语」（15:00–17:00）冲突`。
3. **与固定占用冲突**：与该日生效的固定占用重叠 → `与固定占用「上课」（09:00–11:00）冲突`。

约束：
- **不自动覆盖**：检测到冲突时，本次操作被拒绝，既有数据保持不变。
- **必须可见**：界面提示 + Toast，必要时滚动到提示处。

## 7. 只重排未来，不推翻已完成

- `replanRemaining(dateKey)` 是重排入口：先 `scheduleForDate(dateKey)`，再把未完成任务的 `planStart` 对齐到新 slot 起点。
- 已完成（`status === "done"`）的任务**跳过**，`planStart` 与 `actual` 保持不变。
- 固定任务（`isActiveFixed`）**跳过**，其时段由 `fixedStart`/`fixedEnd` 决定，不因重排而漂移。
- 触发时机：`saveEdit`、`applyReplace`、`toggleRulePause`、`deleteRule`、`saveSettings`、`addTasks` 之后均调用 `replanRemaining(state.date)` 并 `save()`，保证界面时间线与实际排期一致。
- 重排**不删除任何任务**；放不下的仅记入 `overflow`。

### 7.1 暂停规则（`rulePaused`）

- 设置页「时间规则表」可暂停某条固定 / 偏好规则；暂停只置 `task.rulePaused = true`，**不删除任务**。
- 暂停后 `computeSlots` 跳过其固定占用与偏好软约束（`!t.rulePaused` 判断），该时段不再被独占，其他任务可正常排入。
- 暂停的固定任务落入第 3b 步（自由任务）参与普通排布。
- 恢复后重新纳入固定 / 偏好约束，立即触发重排。
- 与任务执行状态 `status === "paused"`（执行中暂停计时）是两个独立概念，互不影响。

## 8. 时间不足时的方案

`shortageOptions(dateKey)` 基于 `computeSlots` 的 `overflow` 生成方案数组，每项 `{ kind, taskId, taskTitle, label, detail, apply }`：

1. **缩短**（`kind: "shorten"`）：`shortened = max(10, duration − remain)`，`apply` 下调 `task.duration` 并置 `estimated: false`。
2. **顺延**（`kind: "postpone"`）：移到次日（`shiftKey(dateKey, 1)`），更新 `planStart` 与固定任务的 `fixedDate`，必要时 `moveTaskDay`。
3. **调整**（`kind: "adjust"`）：固定任务改为自由安排（清空 `fixedStart/End/Date`、`repeat`）；非固定任务改为偏好时间（保留软约束）。

约束：
- **不自动应用**：`shortageOptions` 只生成数据；用户点击方案后 `applyShortageOption(index)` 才执行 `apply()` → `replanRemaining` → `save` → `render` → Toast。
- **不自动删改任务**：系统绝不静默丢弃任务。
- UI：`renderShortagePanel(dateKey)` 渲染 `#shortagePanel`，无 `overflow` 时 `hidden=true`；`state._shortageOptions` 缓存当前方案。

## 9. 自动估时规则

第一版采用可解释的保守估算（Stage 2 已落地 `estimateDuration`）：

- 用户未填写 `duration` 时，由 `estimateDuration` 按任务文本关键词分类 + 长度加成估算（10–180 分钟、5 的倍数），并在界面标注为「估算」。
- 用户填写时以用户值为准（`estimated: false`）。
- 估值规则集中在单一函数中，便于替换；不引入外部服务。

## 10. 边界与已知缺口

- 非固定任务已做 `dayEnd` 容量上限检查（Stage 4 完成，关闭 D-07）；排不下时记入 `overflow` 并给出方案。
- 任务跨夜（开始 + 时长）目前按同一天分钟轴处理，未纳入跨天处理。
- 「顺延」方案仅支持移到次日，未提供指定日期选择。
- 固定占用（`fixedBlocks`）该日生效判断按 `days` 星期；`days` 为空表示每天。