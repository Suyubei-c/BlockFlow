# 时块 BlockFlow · 计时与执行规则（Timer Rules）

> 版本：Stage 0 基线 · 与 `app.js` 的 `startTask` / `pauseTask` / `resumeTask` / `breakTask` / `completeTask` / `tick` 对应

## 1. 任务状态机

```
            start                pause                resume
pending ───────────▶ doing ──────────────▶ paused ──────────────▶ doing
   ▲                 │  │                    │                       │
   │                 │  └── break ──────────▶ paused                 │
   │ 恢复(pending)   │                                              │
   └─────────────────┴──────────────── complete ────────────────────┴──▶ done
```

- `pending` 待开始、`doing` 进行中、`paused` 已暂停、`done` 已完成。
- `done` 任务在列表可「恢复为待开始」（重置 `actual` 等）。

## 2. 计时模型（基于时间戳，不依赖页面存活）

- `actual`：已累计的有效时长（秒）。
- `startedAt`：进入 `doing` 时的时间戳(ms)。
- 当前已用时长 `currentElapsed(task)`：
  - `doing` 且 `startedAt` 存在 → `actual + (now − startedAt) / 1000`；
  - 否则 → `actual`。
- 显示由 `setInterval` 每秒刷新 `tick()`，格式 `HH:MM:SS`（`fmtTimer`）。

## 3. 生命周期操作

### 3.1 开始 `startTask(id)`

- 若已有其他任务在 `doing`，自动将其暂停并记录一次中断，Toast 提示。
- 若目标任务处于 `paused` 且 `interruptedAt` 存在：按离开间隔补记一条中断。
- 置 `doing`、`startedAt = now`、`activeId = id`、`runId = id`，保存并重渲。

### 3.2 暂停 `pauseTask()`

- 仅 `doing` 可暂停。
- `actual += (now − startedAt)/1000`；`startedAt = null`；`status = paused`；`interruptedAt = now`。

### 3.3 继续 `resumeTask()`

- 仅 `paused` 可继续。
- 若 `interruptedAt` 存在且间隔 ≥ 1 分钟，追加一条中断记录（`reason: "暂停 N 分钟"`）。
- 置 `doing`、`startedAt = now`、`activeId = id`。

### 3.4 记录中断 `breakTask()`

- 仅 `doing` 可记录。
- 累计 `actual`，置 `paused`，`interruptedAt = now`，并立即插入一条 `end: null` 的中断记录（`reason: "临时中断"`）。

### 3.5 完成 `completeTask(id)`

- 若 `doing`，先累计 `actual`。
- 将所有未结束的中断记录补 `end = now`。
- 置 `done`，清 `interruptedAt`；若 `activeId` 是该任务则清空。
- 顺延计算：`plan + duration > cap` 时 `delay = plan + duration − cap`。
- Toast 显示实际时长。

## 4. 恢复计时（跨切换 / 锁屏 / 关闭页面）

- 计时以 `startedAt` 时间戳为真值，页面重新打开后由 `currentElapsed` 重算，**不会丢失**。
- 刷新后需在执行页重新选择任务；`startedAt`/`actual` 已持久化，选择后立即显示正确已用时长。
- `ensureTick()` 仅在当前任务为 `doing` 时启动 1 秒定时器；切到非进行中自动停止，避免空转。

## 5. 离开提醒与询问

- 暂停时记录 `interruptedAt`；`tick()` 计算离开时长 `away`。
- `away ≥ settings.leaveThreshold`（默认 15 分钟）时，状态栏显示 `已暂停 · 离开 N 分钟`。
- 规范要求（第 14 条）：此时应**询问离开时间是否计入任务**：
  - 计入 → 离开时长并入 `actual`（中断不计入）；
  - 不计入 → 离开时长不计入，仅保留中断记录。
- 当前原型**仅实现了提醒文案，尚未实现「是否计入」的选择交互**（见 `decisions.md` D-08）。

## 6. 进度备注与下次继续位置

- 规范要求（第 15 条）：暂停/中断时可记录进度备注与下次继续位置。
- 数据模型已预留 `ProgressNote`（见 `data-model.md` 第 7 节），UI 与读写逻辑尚未落地（D-09）。

## 7. 突发情况重排

- 规范要求（第 16 条）：发生变故后重新安排**剩余**任务。
- 原则：
  1. 只重排未完成任务的剩余时长；
  2. 已完成任务与固定时段不动；
  3. 重排前明确提示影响范围，重排结果可见、可撤销。
- 当前原型尚未提供重排入口（D-10）。

## 8. 时间不足处理

- 当剩余任务无法在当天容量内排完时，按 `scheduling-rules.md` 第 8 节提供「缩短 / 顺延 / 调整」三选方案，由用户确认，不静默丢弃。

## 9. 已知限制

- 关闭页面期间不主动累计；恢复依赖 `startedAt` 时间戳。
- 一秒刷新使用 `setInterval`，后台标签页可能被浏览器节流，但恢复时以时间戳重算，不影响总量。
- 尚未处理跨天任务的时间累计归属。