# 时块 BlockFlow · 数据模型（Data Model）

> 版本：Stage 0 基线 · 与现有原型 `app.js` 的 `buildDemoData` / `normalize` 一致
> 持久化键：`localStorage["blockflow.v1"]`

## 1. 顶层结构

```jsonc
{
  "version": 2,                 // number，数据结构版本
  "settings": { /* Settings */ },
  "days": {                     // DayPlan 集合，键为日期字符串 YYYY-MM-DD
    "2026-10-03": [ /* Task[] */ ]
  },
  "activeId": "task-id | null", // 当前进行中/最近活跃任务 id
  "updatedAt": 1720000000000    // number，最后写入时间戳(ms)
}
```

- `days` 是唯一的任务存储位置：**任务归属哪一天，就放在哪一天的数组里**。
- 运行时另有一个非持久化的 `slots`（TimeSlot[]），由 `computeSlots()` 计算，仅用于渲染，不写入 localStorage。

## 2. Task（任务）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 唯一 id，`uid()` 生成；示例数据为 `demo-1` 等。 |
| `title` | string | 任务名，非空，最长 80。 |
| `planStart` | string | 计划开始，格式 `YYYY-MM-DDTHH:MM`。 |
| `duration` | number | 目标时长（分钟），默认 30，最小 5。 |
| `status` | enum | `pending` \| `doing` \| `paused` \| `done`。 |
| `actual` | number | 已累计实际时长（秒）。 |
| `startedAt` | number \| null | 最近一次「进行中」的起始时间戳(ms)。 |
| `interruptedAt` | number \| null | 暂停/中断发生的起始时间戳(ms)。 |
| `interrupts` | Interruption[] | 中断记录数组。 |
| `delay` | number | 顺延分钟数（完成时按容量计算）。 |
| `mode` | enum | `free` \| `preferred` \| `fixed`，缺省回退 `free`。 |
| `prefStart` | string \| null | 偏好开始时间 `HH:MM`（仅 `preferred`）。 |
| `fixedStart` | string \| null | 固定开始 `HH:MM`（仅 `fixed`）。 |
| `fixedEnd` | string \| null | 固定结束 `HH:MM`（仅 `fixed`）。 |
| `fixedDate` | string \| null | 固定任务基准日期 `YYYY-MM-DD`。 |
| `repeat` | enum | `none` \| `daily` \| `weekdays` \| `custom`。 |
| `repeatDays` | number[] | 自定义重复的星期集合，0=周日…6=周六（仅 `custom`）。 |
| `rulePaused` | boolean | 规则（固定 / 偏好）是否暂停；暂停后不占用时间，任务本身保留（与 `status="paused"` 的执行暂停不同）。 |
| `estimated` | boolean | 目标时长是否由系统自动估算（用户未填写时）。 |
| `extStart` | string \| null | 预留：补排段起始（当前由运行时 slots 计算，字段保留）。 |
| `extDuration` | number | 预留：补排时长分钟。 |

**状态集合**：`STATUS_TEXT = { pending, doing, paused, done }`，非法值回退 `pending`。
**安排方式**：`MODE_TEXT = { free, preferred, fixed }`，非法值回退 `free`。
**重复规则**：`REPEAT_TEXT = { none: 仅今天, daily: 每天, weekdays: 工作日, custom: 自定义重复 }`，非法值回退 `none`。

### 兼容与校验（`normalize`）

- 旧数据缺 `mode` → 按 `free` 处理。
- `mode === fixed` 但缺 `fixedStart`/`fixedEnd` → 回退 `free` 并清空固定字段。
- `title` 空 → `"未命名任务"`；`duration` 非法 → 30；`planStart` 缺省 → `<当日>T09:00`。
- `interrupts` 非数组 → `[]`。
- `repeat` 非法 → `none`；`repeatDays` 非数组 → `[]`；`custom` 但无有效星期 → 回退 `none`。
- 旧数据 `repeat === "weekly"` → 迁移为 `custom`，`repeatDays = [固定日期对应星期]`；基准日期非法 → 回退 `none`。
- `rulePaused` 非真值 → `false`。
- `estimated` 非真值 → `false`。
- 解析 localStorage 失败 → 重建示例数据并提示「本地数据损坏，已重置为示例数据」。

## 3. DayPlan（每日计划）

- 表示形式：`days["YYYY-MM-DD"] = Task[]`，不是独立对象，而是按日期分桶的任务数组。
- `getDay(key)` 在键不存在时惰性创建空数组。
- 某任务归属的日期由 `dayKeyOf(task)` 决定：
  - 固定任务且有 `fixedDate` → `fixedDate`；
  - 否则 → `planStart` 的前 10 位日期。

## 4. 排期结果（运行时）

`scheduleForDate(dateKey)` 是统一排期入口，返回：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `slots` | TimeSlot[] | 排好的时间块（渲染用）。 |
| `tasks` | Task[] | 该日期参与排布的任务集合。 |
| `busy` | {start,end}[] | 占用区间（固定任务 + 三餐 + 固定占用 + 已排任务含缓冲）。 |
| `dayStart` / `dayEnd` | number | 容量窗口（起床 / 入睡，跨夜 end>1440）。 |
| `overflow` | {task, remain, kind}[] | 当天排不下的任务；`kind ∈ {fixed-extension, no-capacity}`。 |
| `earliest` | number | 最早可排分钟数（今天 = 当前时刻，未来 = 0）。 |
| `dateKey` | string | 对应日期。 |

由 `computeSlots(tasks, dateKey)` 计算，**不持久化**。`state._shortageOptions` 为 `shortageOptions()` 生成的运行时方案缓存，同样不写入 localStorage。

### 4.1 TimeSlot（时间块，运行时）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `task` | Task | 该时间块所属任务（引用）。 |
| `start` | number | 开始分钟数（0–1440，自 00:00 起）。 |
| `end` | number | 结束分钟数。 |
| `fixed` | boolean | 是否固定段。 |
| `isExtension` | boolean | 是否为「超出固定时段」的补排段。 |
| `soft` | boolean | 是否为偏好时间（软约束）段。 |

辅助函数：
- `primarySlot(slots, id)`：取该任务主段（固定段优先，否则第一段）。
- `slotsOf(slots, id)`：取该任务全部段（含补排）。

## 5. Interruption（中断记录）

```jsonc
{
  "start": 1720000000000,   // number，中断开始时间戳(ms)
  "end": 1720000060000,     // number | null，结束时间戳；null 表示未结束
  "reason": "暂停 10 分钟"   // string，说明
}
```

- 由暂停/继续/记录中断产生；完成任务时对未结束记录补 `end`。
- 中断次数计入复盘。

## 6. Settings（设置）

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `sleepStart` | string | `"23:00"` | 入睡时间。 |
| `sleepEnd` | string | `"07:00"` | 起床时间。 |
| `breakfast` | string | `"08:00"` | 早餐开始。 |
| `lunch` | string | `"12:00"` | 午餐开始。 |
| `dinner` | string | `"18:30"` | 晚餐开始。 |
| `mealDuration` | number | `40` | 每餐时长（分钟）。 |
| `breakBuffer` | number | `10` | 任务之间的休息缓冲（分钟）。 |
| `fixedBlocks` | FixedBlock[] | `[]` | 固定占用列表（上课 / 通勤等周期性不可用时段）。 |
| `leaveThreshold` | number | `15` | 离开提醒阈值（分钟）。 |
| `dayStart` | string | `"07:00"` | 备用：一天起点。 |
| `sleepEnd` 同时作为可用时间起点 | | | 容量计算优先取 `sleepEnd`。 |
| `dayEnd` | string | `"23:00"` | 备用：一天终点。 |

- 设置与任务同存于 `blockflow.v1`，`normalize` 用 `Object.assign` 与默认值合并，缺字段自动补齐。
- `breakBuffer` 在排期中由 `bufferMinutes()` 钳制到 5–10 分钟，存储值本身不变。

### FixedBlock（固定占用）

```jsonc
{
  "label": "上课",      // string，显示名，缺省 "固定占用"
  "start": "09:00",     // string，开始时间 HH:MM
  "end": "11:00",       // string，结束时间 HH:MM（须晚于 start）
  "days": [1, 3, 5]     // number[]，生效星期（0=周日…6=周六），空数组表示每天
}
```

- `normalizeFixedBlocks(list)`：过滤非法项（缺 `start`/`end`、`end ≤ start`、非对象），`days` 归一化为去重后的 0–6 整数，`label` 缺省 `"固定占用"`；整体非数组 → `[]`。
- `fixedBlocksOn(dateKey)`：按 `dateKey` 的星期筛选当日生效的固定占用（`days` 为空则每天生效）。
- 生效的固定占用并入 `computeSlots` 的 busy 集合与 `fixedConflict` 的占用集合，参与避让与冲突检测（见 `scheduling-rules.md`）。

## 7. ProgressNote（进度备注）· ✅ 已落地（Stage 5）

执行页「进度备注」面板已实现，落在 Task 的两个字段上（旧数据缺字段由 `normalize` 补空，不破坏兼容）：

```jsonc
{
  "notes": [                        // ProgressNote[]，按时间正序追加
    { "text": "已完成第一部分", "at": 1720000000000 }
  ],
  "resumeFrom": "从第 3 节继续"     // string，下次继续位置，空串表示未填写
}
```

- `normalizeNotes(list)`：过滤空项与非对象，`text` 去空白后为空则丢弃，`at` 非法补 `0`；整体非数组 → `[]`。
- `resumeFrom` 非字符串一律归一化为 `""`。
- 写入口：`saveRunNote()`（`app.js`）——校验「备注或继续位置」至少一项非空后才写入并 `save()`，失败走 Toast。
- 读出口：执行页 `renderRunNotes` / `renderNoteList`；复盘卡片与历史详情复用同结构（`review-notes` / `note-resume`），备注按 `at` 倒序展示。
- 备注属于任务数据，随 `blockflow.v1` 持久化；计时、编辑、新增备注后复盘与历史自动同步（均在 `render()` 时重新计算）。

## 8. RepeatRule（重复规则）

| 值 | 语义 | 生效判定（`fixedAppliesOn`） |
| --- | --- | --- |
| `none`（仅今天） | 不重复 | 仅基准日期 `fixedDate` 生效。 |
| `daily` | 每天 | 任意日期生效。 |
| `weekdays` | 工作日 | 周一至周五生效（`getDay()` 1–5）。 |
| `custom` | 自定义重复 | `task.repeatDays` 包含该日期星期则生效。 |

- 仅对固定任务有意义，但字段对所有任务保留。
- `custom` 需至少选择一天；`normalize` 对无有效星期的 `custom` 回退 `none`。
- 首版曾有 `weekly`（每周同一天），现已移除；旧数据由 `normalize` 迁移为 `custom`。

## 9. 完整示例

```jsonc
{
  "version": 2,
  "settings": { "sleepStart": "23:00", "sleepEnd": "07:00", "breakfast": "08:00",
                "lunch": "12:00", "dinner": "18:30", "mealDuration": 40,
                "breakBuffer": 10, "leaveThreshold": 15,
                "dayStart": "07:00", "dayEnd": "23:00" },
  "days": {
    "2026-10-03": [
      { "id": "demo-1", "title": "梳理本周待办", "planStart": "2026-10-03T14:15",
        "duration": 30, "status": "done", "actual": 1680, "startedAt": null,
        "interruptedAt": null, "interrupts": [], "delay": 0, "mode": "free",
        "prefStart": null, "fixedStart": null, "fixedEnd": null,
        "fixedDate": null, "repeat": "none", "extStart": null, "extDuration": 0 },
      { "id": "demo-2", "title": "英语", "planStart": "2026-10-03T15:00",
        "duration": 180, "status": "pending", "actual": 0, "startedAt": null,
        "interruptedAt": null, "interrupts": [], "delay": 0, "mode": "fixed",
        "prefStart": null, "fixedStart": "15:00", "fixedEnd": "17:00",
        "fixedDate": "2026-10-03", "repeat": "none", "extStart": null, "extDuration": 0 }
    ]
  },
  "activeId": null,
  "updatedAt": 1720000000000
}
```

> 示例中的「英语」仅为任务名占位，不包含任何学习方法建议。