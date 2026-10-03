# 时块 BlockFlow · 架构说明（Architecture）

> 本文档描述最终封版版本的纯前端架构、数据流、计时与排期实现。所有能力均在浏览器本地完成，无后端、无数据库、无云端。

## 1. 技术形态

- **纯静态三件套**：`index.html` + `styles.css` + `app.js`（原生 JavaScript，无框架、无构建步骤、无 npm 依赖）。
- **PWA 可选增强**：`manifest.webmanifest` + `service-worker.js` + `icons/`，仅在 http/https 下生效；`file://` 直接双击打开仍完全可用。
- **零外部资源**：不请求任何外部字体、图片、脚本或 CDN。
- **运行形态**：
  1. 双击 `index.html`（`file://`）——首选，双击即用。
  2. 本地静态服务（`http://localhost`）——启用 Service Worker，可离线、可安装到桌面。

## 2. 文件与职责

| 文件 | 职责 |
| --- | --- |
| `index.html` | 单页骨架：今日 / 新建 / 执行 / 复盘 / 设置五个视图 + 弹窗 + Toast |
| `styles.css` | 移动端优先响应式样式、深色模式、可访问性焦点与断点 |
| `app.js` | 全部业务逻辑（单文件 IIFE，无模块系统）：状态、存储、排期、计时、渲染、事件绑定 |
| `service-worker.js` | 静态资源缓存（Cache Storage），离线骨架加载；不触碰 localStorage |
| `manifest.webmanifest` | PWA 元信息（固定 `id`/`start_url`/`scope`、图标、主题色） |
| `icons/*.png` | 应用图标（192 / 512 / maskable-512），本地生成 |

## 3. 数据模型

数据集中存放于单一对象 `state.data`，序列化后写入 localStorage：

```
state.data = {
  version: 2,
  settings: { ... },     // 睡眠窗口、吃饭、缓冲、离开阈值、固定占用等
  days: { "YYYY-MM-DD": [Task, ...] },   // 按天分桶
  activeId: string|null, // 当前正在执行的任务
  updatedAt: number
}
```

- **Task**：`id`/`title`/`mode`(free|preferred|fixed)/`duration`(目标分钟)/`fixedStart`/`fixedEnd`/`fixedDate`/`repeat`/`repeatDays`/`rulePaused`/`status`(todo|doing|paused|done)/`actual`(秒)/`startedAt`/`interruptions[]`/`notes[]`/`resumeFrom` 等。
- **Interruption**：中断记录（含中断原因类型 `counted`/`uncounted`、时长）。
- **Settings**：睡眠窗口、吃饭时段、任务间缓冲、离开提醒阈值（`leaveThreshold`，1–60 分钟）、固定占用 `fixedBlocks[]`。
- **ProgressNote**：`{ text, at }`，进度备注与「下次继续位置」。
- **RepeatRule**：`none` / `daily` / `weekdays` / `custom`（仅 custom 使用 `repeatDays`）。

> 兼容性：旧数据缺失字段由 `normalize()` 补齐并钳制非法值；损坏数据自动重置为示例数据并给出可见提示。

## 4. 数据流

```
用户操作（表单 / 按钮 / 计时）
   → 修改 state.data
   → save()：写 localStorage（键 blockflow.v1）
   → replanRemaining() / scheduleForDate()：按需重算剩余排期
   → render()：重绘当前视图（按 state.date 计算当日计划）
```

- **单一数据源**：所有视图读同一份 `state.data`，任何变更后重算并重绘，避免多份状态不一致。
- **持久化**：`save()` 统一封装 `localStorage.setItem`，失败时 Toast 提示（不静默）。
- **加载**：`load()` 读取并 `normalize()`；无数据时写入示例数据。

## 5. 排期引擎

- **入口**：`scheduleForDate(dateKey)` 为唯一排期入口，内部用 `computeSlots` 生成时间块。
- **dayWindow**：先锁定睡眠窗口，得到当日可用容量窗口。
- **busy 集合**：吃饭时段、固定占用（`fixedBlocks`，按星期生效）、**生效中的固定任务**（`isActiveFixed`：固定任务且未 `rulePaused`）并入已占用集合。
- **排序规则**：偏好时间任务优先满足，其余自由任务按序填充剩余空档。
- **固定任务补排**：固定时段放不下目标时长时，剩余时长自动排到当天其他空档。
- **缓冲**：任务之间保留缓冲（`bufferMinutes()` 统一口径），避免首尾相接。
- **排除过去**：不把任务排到早于当前时刻的时间。
- **超出容量**：登记为 `overflow` 并给出**可见的短缺面板**（缩短 / 顺延 / 调整），不静默丢弃任务。
- **重排**：`replanRemaining()` 只重排未完成、非固定的任务；任何影响排期的变更（增删任务、编辑规则、改设置）在落库后触发。

## 6. 计时模型

- **基于时间戳，不依赖 `setInterval` 精度**：`currentElapsed(task) = actual + (Date.now() - startedAt)/1000`（doing 状态），刷新后按时间戳恢复。
- **状态机**：`todo → doing → paused → doing → done`，开始 / 暂停 / 继续 / 完成均落库。
- **后台离开确认**：
  - `onHidden`（`visibilitychange hidden` / `pagehide` / `beforeunload`）记录离开起点 `pendingGapStart`。
  - `onVisible`（`visibilitychange visible` / `pageshow`）计算离开时长；未超阈值（默认 5 分钟）直接继续，超阈值创建 `pendingGap` 并弹确认框。
  - **四个选项**：全部计入 / 全部不计入 / 只计入一部分 / 从离开时暂停。
  - `pendingGap` 与用户选择写入 localStorage，刷新后恢复；确认后清空，避免重复结算。
  - 展示与结算共用同一按 `pendingGapStart`/`pendingGapEnd` 实时计算的间隔，24 小时制、跨天显示日期。

## 7. 渲染与响应式

- 五个视图由 `switchView` 切换，仅可见视图渲染激活态。
- 断点：320 / 375–430 / 768 / 1200，配合 `viewport-fit=cover` 与底部安全区。
- 可访问性：skip link、`role="tabpanel"`、弹窗焦点陷阱（`trapFocus`）、`:focus-visible`、`aria-live` 提示、`prefers-reduced-motion` 降级。
- 深色模式：通过 `prefers-color-scheme` 变量覆盖，保证对比度。

## 8. PWA 与存储隔离

- Service Worker 只使用 **Cache Storage**（缓存名前缀 `blockflow-static-`），与 localStorage 是两套独立存储。
- 缓存版本号 `CACHE_VERSION` 变更 → 新缓存建立 + `activate` 清理旧前缀缓存，**绝不删除 `blockflow.v1` 任务数据**。
- 离线策略：导航请求网络优先、失败回退缓存 `index.html`；静态资源缓存优先并回填；仅同源 GET。
- 数据导出 / 导入为本地 JSON 文件操作，不经过任何云端。