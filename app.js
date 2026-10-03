(function () {
  "use strict";

  var STORAGE_KEY = "blockflow.v1";

  var DEFAULT_SETTINGS = {
    sleepStart: "23:00",
    sleepEnd: "07:00",
    breakfast: "08:00",
    lunch: "12:00",
    dinner: "18:30",
    mealDuration: 40,
    breakBuffer: 10,
    leaveThreshold: 5,
    dayStart: "07:00",
    dayEnd: "23:00",
    fixedBlocks: []
  };

  var STATUS_TEXT = {
    pending: "待开始",
    doing: "进行中",
    paused: "已暂停",
    done: "已完成"
  };

  var MODE_TEXT = {
    free: "自由安排",
    preferred: "偏好时间",
    fixed: "固定时间"
  };

  var REPEAT_TEXT = {
    none: "仅今天",
    daily: "每天",
    weekdays: "工作日",

    custom: "自定义重复"
  };

  var state = {
    view: "today",
    date: todayKey(),
    runId: null,
    data: null,
    leaveFlow: null,   /* Stage 7 运行时：待用户确认的离开结算状态，不持久化 */
    lastActivityAt: Date.now()
  };

  var tickTimer = null;

  /* ---------------- 工具函数 ---------------- */
  function pad(n) { return String(n).padStart(2, "0"); }

  function todayKey() { return toKey(new Date()); }

  function toKey(d) {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function shiftKey(key, delta) {
    var p = key.split("-");
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    d.setDate(d.getDate() + delta);
    return toKey(d);
  }

  function parseMinutes(hhmm) {
    if (!hhmm || typeof hhmm !== "string") return 0;
    var p = hhmm.split(":");
    var h = Number(p[0]);
    var m = Number(p[1]);
    if (isNaN(h) || isNaN(m)) return 0;
    return h * 60 + m;
  }

  function minutesToHHMM(min) {
    var m = ((Math.round(min) % 1440) + 1440) % 1440;
    return pad(Math.floor(m / 60)) + ":" + pad(m % 60);
  }

  function fmtDuration(min) {
    var total = Math.max(0, Math.round(min));
    var h = Math.floor(total / 60);
    var m = total % 60;
    if (h > 0 && m > 0) return h + " 小时 " + m + " 分";
    if (h > 0) return h + " 小时";
    return m + " 分钟";
  }

  function fmtShort(min) {
    var total = Math.max(0, Math.round(min));
    if (total < 60) return total + "m";
    var h = total / 60;
    return (h % 1 === 0 ? h : h.toFixed(1)) + "h";
  }

  function fmtClock(ts) {
    var d = new Date(ts);
    return pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  /* Stage 7 修复：带日期的 24 小时制时间戳格式化（同一天只显示一份月日） */
  function fmtDateTime(ts, withDate) {
    var d = new Date(ts);
    var hm = pad(d.getHours()) + ":" + pad(d.getMinutes());
    if (!withDate) return hm;
    return (d.getMonth() + 1) + "月" + d.getDate() + "日 " + hm;
  }

  /* Stage 7 修复：离开区间的人类可读时长（输入秒；≥1 小时显示「N 小时 M 分钟」，否则「N 分钟」） */
  function fmtLeaveSpan(seconds) {
    var total = Math.max(0, Math.round(Number(seconds) / 60));   /* 分钟，四舍五入 */
    if (total < 60) return total + " 分钟";
    var h = Math.floor(total / 60);
    var m = total % 60;
    return h + " 小时" + (m > 0 ? " " + m + " 分钟" : "");
  }

  /* Stage 7 修复：同一天判断（用于离开区间是否跨天） */
  function sameDay(a, b) {
    var da = new Date(a), db = new Date(b);
    return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
  }

  function fmtTimer(seconds) {
    var s = Math.max(0, Math.floor(seconds));
    return pad(Math.floor(s / 3600)) + ":" + pad(Math.floor((s % 3600) / 60)) + ":" + pad(s % 60);
  }

  /* Stage 7：安全秒数读取。时间戳异常/负数/超出合理范围时回退为 0 */
  var MAX_SECONDS = 365 * 24 * 3600;   /* 单次/累计计时上限：365 天，超出视为异常 */
  function safeSeconds(v) {
    var n = Number(v);
    if (!isFinite(n) || n <= 0) return 0;
    if (n > MAX_SECONDS) return MAX_SECONDS;
    return Math.round(n);
  }

  /* Stage 7：安全时间戳天数差（从 a 到 b 的秒数），异常回退 0；负数回退 0 */
  function secondsBetween(a, b) {
    var t1 = Number(a), t2 = Number(b);
    if (!isFinite(t1) || !isFinite(t2)) return 0;
    var diff = (t2 - t1) / 1000;
    if (!isFinite(diff) || diff <= 0) return 0;
    if (diff > MAX_SECONDS) diff = MAX_SECONDS;
    return Math.round(diff);
  }

  /* Stage 7：离开阈值（分钟），默认 5，钳制在 1–60 */
  function leaveThresholdMinutes() {
    var v = Number(state.data && state.data.settings ? state.data.settings.leaveThreshold : 5);
    if (!isFinite(v) || v < 1) v = 5;
    if (v > 60) v = 60;
    return Math.round(v);
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function $(id) { return document.getElementById(id); }

  function weekLabel(key) {
    var p = key.split("-");
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    return "星期" + "日一二三四五六".charAt(d.getDay());
  }

  function dateLabelText(key) {
    var p = key.split("-");
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    var today = todayKey();
    var prefix = "";
    if (key === today) prefix = "今天 · ";
    else if (key === shiftKey(today, -1)) prefix = "昨天 · ";
    else if (key === shiftKey(today, 1)) prefix = "明天 · ";
    return prefix + (d.getMonth() + 1) + " 月 " + d.getDate() + " 日";
  }

  /* ---------------- 存储 ---------------- */
  function clone(obj) { return JSON.parse(JSON.stringify(obj)); }

  function buildDemoData() {
    var k = todayKey();
    var now = new Date();
    var startBase = Math.max(0, now.getHours() * 60 + now.getMinutes() - 45);
    var base = k + "T" + minutesToHHMM(startBase);
    return {
      version: 2,
      settings: clone(DEFAULT_SETTINGS),
      days: (function () {
        var days = {};
        days[k] = [
          { id: "demo-1", title: "梳理本周待办", planStart: base, duration: 30, status: "done", actual: 1680, startedAt: null, interruptedAt: null, interrupts: [], delay: 0, mode: "free", prefStart: null, fixedStart: null, fixedEnd: null, fixedDate: null, repeat: "none", extStart: null, extDuration: 0 },
          { id: "demo-2", title: "英语", planStart: k + "T15:00", duration: 180, status: "pending", actual: 0, startedAt: null, interruptedAt: null, interrupts: [], delay: 0, mode: "fixed", prefStart: null, fixedStart: "15:00", fixedEnd: "17:00", fixedDate: k, repeat: "none", extStart: null, extDuration: 0 },
          { id: "demo-3", title: "写周报", planStart: addBase(base, 95), duration: 40, status: "pending", actual: 0, startedAt: null, interruptedAt: null, interrupts: [], delay: 0, mode: "free", prefStart: null, fixedStart: null, fixedEnd: null, fixedDate: null, repeat: "none", extStart: null, extDuration: 0 },
          { id: "demo-4", title: "跑步 30 分钟", planStart: addBase(base, 145), duration: 30, status: "pending", actual: 0, startedAt: null, interruptedAt: null, interrupts: [], delay: 0, mode: "free", prefStart: null, fixedStart: null, fixedEnd: null, fixedDate: null, repeat: "none", extStart: null, extDuration: 0 }
        ];
        return days;
      })(),
      activeId: null,
      updatedAt: Date.now()
    };
  }

  function addBase(base, minutes) {
    var key = base.slice(0, 10);
    var start = parseMinutes(base.slice(11));
    var t = start + minutes;
    var dayShift = Math.floor(t / 1440);
    var finalKey = dayShift !== 0 ? shiftKey(key, dayShift) : key;
    return finalKey + "T" + minutesToHHMM(t);
  }

  function save() {
    state.data.updatedAt = Date.now();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
    } catch (e) {
      toast("保存失败：浏览器存储不可用", "error");
    }
  }

  function load() {
    var raw = null;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { raw = null; }
    if (!raw) {
      state.data = buildDemoData();
      save();
      return;
    }
    try {
      var parsed = JSON.parse(raw);
      state.data = normalize(parsed);
    } catch (e) {
      state.data = buildDemoData();
      save();
      toast("本地数据损坏，已重置为示例数据", "error");
    }
  }

  /* 归一化进度备注：统一为 { text, at } 数组，剔除空项 */
  function normalizeNotes(list) {
    if (!Array.isArray(list)) return [];
    return list.map(function (n) {
      if (!n) return null;
      var text = typeof n === "string" ? n : String(n.text || "");
      text = text.trim();
      if (!text) return null;
      return { text: text, at: Number(n.at) || Date.now() };
    }).filter(function (n) { return n !== null; });
  }

  function normalizeFixedBlocks(list) {
    if (!Array.isArray(list)) return [];
    return list.map(function (b) {
      var start = b && typeof b.start === "string" ? b.start : "";
      var end = b && typeof b.end === "string" ? b.end : "";
      if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return null;
      if (parseMinutes(end) <= parseMinutes(start)) return null;
      var days = Array.isArray(b.days)
        ? b.days.map(Number).filter(function (d) { return d >= 0 && d <= 6; })
        : [];
      return {
        id: b.id || uid(),
        label: String(b.label || "固定占用"),
        start: start,
        end: end,
        days: days
      };
    }).filter(function (b) { return b !== null; });
  }

  function normalize(obj) {
    var rawSettings = Object.assign(clone(DEFAULT_SETTINGS), (obj && obj.settings) || {});
    rawSettings.fixedBlocks = normalizeFixedBlocks(rawSettings.fixedBlocks);
    /* Stage 7：离开阈值钳制在 1–60，异常回退默认 5 */
    var lt = Number(rawSettings.leaveThreshold);
    if (!isFinite(lt) || lt <= 0) lt = DEFAULT_SETTINGS.leaveThreshold;
    lt = Math.max(1, Math.min(60, Math.round(lt)));
    rawSettings.leaveThreshold = lt;
    var data = {
      version: 2,
      settings: rawSettings,
      days: (obj && obj.days) || {},
      activeId: (obj && obj.activeId) || null,
      updatedAt: (obj && obj.updatedAt) || Date.now()
    };
    Object.keys(data.days).forEach(function (k) {
      var arr = data.days[k];
      if (!Array.isArray(arr)) { data.days[k] = []; return; }
      data.days[k] = arr.map(function (t) {
        var mode = MODE_TEXT[t.mode] ? t.mode : "free";
        var fixedStart = t.fixedStart || null;
        var fixedEnd = t.fixedEnd || null;
        if (mode === "fixed" && (!fixedStart || !fixedEnd)) {
          mode = "free";
          fixedStart = null;
          fixedEnd = null;
        }
        var repeat = REPEAT_TEXT[t.repeat] ? t.repeat : "none";
        var repeatDays = Array.isArray(t.repeatDays)
          ? t.repeatDays.map(Number).filter(function (d) { return d >= 0 && d <= 6; })
          : [];
        /* 旧数据迁移：weekly → custom（取固定日期对应星期）；无法迁移则回退 none */
        if (t.repeat === "weekly") {
          var baseKey = t.fixedDate || String(t.planStart || k).slice(0, 10);
          if (/^\d{4}-\d{2}-\d{2}$/.test(baseKey)) {
            repeat = "custom";
            repeatDays = [weekdayOf(baseKey)];
          } else {
            repeat = "none";
            repeatDays = [];
          }
        }
        if (repeat === "custom" && !repeatDays.length) repeat = "none";
        return {
          id: t.id || uid(),
          title: String(t.title || "未命名任务"),
          planStart: t.planStart || k + "T09:00",
          duration: Number(t.duration) || 30,
          status: STATUS_TEXT[t.status] ? t.status : "pending",
          actual: Number(t.actual) || 0,
          startedAt: t.startedAt || null,
          interruptedAt: t.interruptedAt || null,
          interrupts: Array.isArray(t.interrupts) ? t.interrupts : [],
          delay: Number(t.delay) || 0,
          mode: mode,
          prefStart: t.prefStart || null,
          fixedStart: fixedStart,
          fixedEnd: fixedEnd,
          fixedDate: t.fixedDate || null,
          repeat: repeat,
          repeatDays: repeatDays,
          rulePaused: !!t.rulePaused,
          estimated: !!t.estimated,
          extStart: t.extStart || null,
          extDuration: Number(t.extDuration) || 0,
          notes: normalizeNotes(t.notes),
          resumeFrom: typeof t.resumeFrom === "string" ? t.resumeFrom : "",
          /* Stage 7：后台计时与离开确认字段（旧数据补默认，不破坏兼容） */
          lastVisibleAt: Number(t.lastVisibleAt) || null,
          pendingGapStart: Number(t.pendingGapStart) || null,
          pendingGapEnd: Number(t.pendingGapEnd) || null,
          pendingGapSeconds: safeSeconds(t.pendingGapSeconds)
        };
      });
    });
    return data;
  }

  /* ---------------- 数据访问 ---------------- */
  function getDay(key) {
    if (!state.data.days[key]) state.data.days[key] = [];
    return state.data.days[key];
  }

  function findTask(id) {
    var keys = Object.keys(state.data.days);
    for (var i = 0; i < keys.length; i++) {
      var arr = state.data.days[keys[i]];
      for (var j = 0; j < arr.length; j++) {
        if (arr[j].id === id) return arr[j];
      }
    }
    return null;
  }

  function dayKeyOf(task) {
    if (task.mode === "fixed" && task.fixedDate) return task.fixedDate;
    return task.planStart.slice(0, 10);
  }

  function setTaskDate(task, dateKey) {
    task.planStart = dateKey + "T" + task.planStart.slice(11);
    if (task.mode === "fixed" && task.fixedDate) task.fixedDate = dateKey;
  }

  function moveTaskDay(id, fromKey, toKey) {
    if (fromKey === toKey) return;
    if (!state.data.days[fromKey]) return;
    var idx = -1;
    for (var i = 0; i < state.data.days[fromKey].length; i++) {
      if (state.data.days[fromKey][i].id === id) { idx = i; break; }
    }
    if (idx < 0) return;
    var task = state.data.days[fromKey].splice(idx, 1)[0];
    setTaskDate(task, toKey);
    if (!state.data.days[toKey]) state.data.days[toKey] = [];
    state.data.days[toKey].push(task);
  }

  function removeTask(id) {
    Object.keys(state.data.days).forEach(function (k) {
      state.data.days[k] = state.data.days[k].filter(function (t) { return t.id !== id; });
    });
  }

  function bucketKeyOf(id) {
    var keys = Object.keys(state.data.days);
    for (var i = 0; i < keys.length; i++) {
      if (state.data.days[keys[i]].some(function (t) { return t.id === id; })) return keys[i];
    }
    return null;
  }

  function sortTasks(arr) {
    return arr.slice().sort(function (a, b) {
      return parseMinutes(a.planStart.slice(11)) - parseMinutes(b.planStart.slice(11));
    });
  }

  function plannedMinutes(tasks) {
    return tasks.reduce(function (sum, t) { return sum + t.duration; }, 0);
  }

  /* 扁平列出所有任务（跨天，按 id 去重） */
  function allTasks() {
    var seen = {};
    var out = [];
    Object.keys(state.data.days).forEach(function (k) {
      state.data.days[k].forEach(function (t) {
        if (!seen[t.id]) { seen[t.id] = true; out.push(t); }
      });
    });
    return out;
  }

  function weekdayOf(key) {
    var p = key.split("-");
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])).getDay();
  }

  /* 固定任务在指定日期是否生效 */
  function fixedAppliesOn(task, dateKey) {
    if (!isFixedTask(task)) return false;
    var base = task.fixedDate || dayKeyOf(task);
    if (base === dateKey) return true;
    if (task.repeat === "daily") return true;
    if (task.repeat === "weekdays") { var w = weekdayOf(dateKey); return w >= 1 && w <= 5; }

    if (task.repeat === "custom") {
      var days = Array.isArray(task.repeatDays) ? task.repeatDays : [];
      return days.indexOf(weekdayOf(dateKey)) !== -1;
    }
    return false;
  }

  /* 指定日期实际需要展示与排布的任务集合：本天非固定任务 + 当天生效的固定任务 */
  function collectTasks(dateKey) {
    var own = getDay(dateKey).filter(function (t) { return !isFixedTask(t); });
    var fixed = allTasks().filter(function (t) {
      var base = t.fixedDate || dayKeyOf(t);
      if (base === dateKey) return false; /* 已包含在 own 之外的固定任务需单独收集，见下 */
      return isFixedTask(t) && fixedAppliesOn(t, dateKey);
    });
    /* 本天自身存储的固定任务也要纳入 */
    getDay(dateKey).forEach(function (t) {
      if (isFixedTask(t)) fixed.push(t);
    });
    var seen = {};
    return own.concat(fixed).filter(function (t) {
      if (seen[t.id]) return false;
      seen[t.id] = true;
      return true;
    });
  }

  /* 时间轴总容量（全天可用时间） */
  function timelineCapacity() {
    var s = state.data.settings;
    var start = parseMinutes(s.sleepEnd || s.dayStart || "07:00");
    var end = parseMinutes(s.sleepStart || s.dayEnd || "23:00");
    var cap = end - start;
    if (cap <= 0) cap += 1440;
    return cap;
  }

  /* 固定占用：三餐（睡眠不计入，因为可用时间已排除睡眠） */
  function mealTotal() {
    var s = state.data.settings;
    return 3 * (Number(s.mealDuration) || 0);
  }

  /* 顺延总量 */
  function delayTotal(tasks) {
    return tasks.reduce(function (sum, t) { return sum + (Number(t.delay) || 0); }, 0);
  }

  /* 计算任务在时间线上的展示区间（固定时间优先锁定，其余任务自动避让） */
  /* 指定日期生效的固定占用（上课/通勤等）：days 为空表示每天 */
  function fixedBlocksOn(dateKey) {
    var arr = state.data.settings.fixedBlocks || [];
    var w = weekdayOf(dateKey);
    return arr.filter(function (b) {
      if (!b || !b.start || !b.end) return false;
      if (parseMinutes(b.end) <= parseMinutes(b.start)) return false;
      if (!b.days || !b.days.length) return true;
      return b.days.indexOf(w) !== -1;
    });
  }

  function busyOf(fixed, dateKey) {
    var s = state.data.settings;
    var list = fixed.slice();
    var meals = [
      { start: parseMinutes(s.breakfast), dur: Number(s.mealDuration) || 0 },
      { start: parseMinutes(s.lunch), dur: Number(s.mealDuration) || 0 },
      { start: parseMinutes(s.dinner), dur: Number(s.mealDuration) || 0 }
    ];
    meals.forEach(function (m) { if (m.dur > 0) list.push({ start: m.start, end: m.start + m.dur }); });
    fixedBlocksOn(dateKey).forEach(function (b) {
      list.push({ start: parseMinutes(b.start), end: parseMinutes(b.end) });
    });
    return list;
  }

  /* 从 from 之后寻找长度 dur 的空闲起点 */
  function findFreeSlot(busy, from, dur, cap) {
    var start = Math.max(0, from);
    var guard = 0;
    var changed = true;
    while (changed && guard < 400) {
      changed = false;
      guard++;
      for (var i = 0; i < busy.length; i++) {
        var b = busy[i];
        if (start < b.end && start + dur > b.start) { start = b.end; changed = true; }
      }
    }
    if (start + dur > cap) return null;
    return start;
  }

  /* 固定时间冲突检测：返回冲突提示文案，无冲突返回 null */
  function fixedConflict(fixedStart, fixedEnd, tasks, excludeId, dateKey) {
    var s = state.data.settings;
    var st = parseMinutes(fixedStart);
    var en = parseMinutes(fixedEnd);
    var meals = [
      { name: "早餐", start: parseMinutes(s.breakfast), dur: Number(s.mealDuration) || 0 },
      { name: "午餐", start: parseMinutes(s.lunch), dur: Number(s.mealDuration) || 0 },
      { name: "晚餐", start: parseMinutes(s.dinner), dur: Number(s.mealDuration) || 0 }
    ];
    for (var i = 0; i < meals.length; i++) {
      var m = meals[i];
      if (m.dur > 0 && st < m.start + m.dur && en > m.start) {
        return "与" + m.name + "（" + minutesToHHMM(m.start) + "–" + minutesToHHMM(m.start + m.dur) + "）冲突";
      }
    }
    var blocks = dateKey ? fixedBlocksOn(dateKey) : [];
    for (var k = 0; k < blocks.length; k++) {
      var fb = blocks[k];
      var fbStart = parseMinutes(fb.start);
      var fbEnd = parseMinutes(fb.end);
      if (st < fbEnd && en > fbStart) {
        return "与固定占用「" + fb.label + "」（" + fb.start + "–" + fb.end + "）冲突";
      }
    }
    for (var j = 0; j < tasks.length; j++) {
      var t = tasks[j];
      if (t.id === excludeId) continue;
      if (t.mode === "fixed" && t.fixedStart && t.fixedEnd && !t.rulePaused) {
        var tStart = parseMinutes(t.fixedStart);
        var tEnd = parseMinutes(t.fixedEnd);
        if (st < tEnd && en > tStart) {
          return "与固定任务「" + t.title + "」（" + t.fixedStart + "–" + t.fixedEnd + "）冲突";
        }
      }
    }
    return null;
  }

  /* 排期的时间窗：起点 = 起床，终点 = 入睡（跨夜则 +1440）；用于容量上限判断 */
  function dayWindow() {
    var s = state.data.settings;
    var start = parseMinutes(s.sleepEnd || s.dayStart || "07:00");
    var end = parseMinutes(s.sleepStart || s.dayEnd || "23:00");
    if (end <= start) end += 1440;
    return { start: start, end: end };
  }

  /* 缓冲统一到 5–10 分钟：用户设为 0 时取 5，超过 10 取 10，缺省 10 */
  function bufferMinutes() {
    var b = Number(state.data.settings.breakBuffer);
    if (!isFinite(b) || b <= 0) return 5;
    return Math.max(5, Math.min(10, b));
  }

  /* 给定日期的最早可排分钟数：今天不能排到过去；未来日期不限 */
  function earliestMinute(dateKey) {
    if (dateKey !== todayKey()) return 0;
    var now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }

  /* 核心排期：锁定睡眠(容量)/吃饭/课程(固定占用)/固定任务，再排偏好与自由任务。
     dateKey 传入用于取当日固定占用、判断"过去时间"与容量窗口。
     返回 { slots, busy, dayStart, dayEnd, overflow, pastStart }。 */
  function computeSlots(tasks, dateKey) {
    var dk = dateKey || state.date;
    var s = state.data.settings;
    var win = dayWindow();
    var slots = [];

    /* 1. 固定任务优先锁定时段 */
    var fixed = [];
    sortTasks(tasks).forEach(function (t) {
      if (isActiveFixed(t)) {
        var fs = parseMinutes(t.fixedStart);
        var fe = parseMinutes(t.fixedEnd);
        if (fe > fs) fixed.push({ id: t.id, start: fs, end: fe });
      }
    });
    /* busy = 固定任务 + 三餐 + 固定占用（上课/通勤），睡眠由容量窗口排除 */
    var busy = busyOf(fixed, dk);

    var earliest = earliestMinute(dk);
    var overflow = [];    /* 当天容量不足、排不下的任务 */

    /* 2. 固定任务：只占 min(固定时长, 目标时长)，超出部分自动找空位补排 */
    sortTasks(tasks).forEach(function (t) {
      if (!isActiveFixed(t)) return;
      var fs = parseMinutes(t.fixedStart);
      var fe = parseMinutes(t.fixedEnd);
      if (fe <= fs) return;
      var winLen = fe - fs;
      var used = Math.min(winLen, t.duration);
      /* 固定段本身锁定（即使早于当前时刻也如实展示），补排段才受"不能排到过去"约束 */
      slots.push({ task: t, start: fs, end: fs + used, fixed: true, isExtension: false });

      var rest = t.duration - used;
      if (rest > 0) {
        var from = Math.max(fs + used, earliest);
        var ext = findFreeSlot(busy, from, rest, win.end);
        if (ext !== null) {
          slots.push({ task: t, start: ext, end: ext + rest, fixed: false, isExtension: true });
          busy.push({ start: ext, end: ext + rest });
        } else {
          overflow.push({ task: t, remain: rest, kind: "fixed-extension" });
        }
      }
    });

    /* 3a. 偏好任务先排（软约束，避让后自动顺延） */
    placeNonFixed(tasks.filter(function (t) { return !isActiveFixed(t) && t.mode === "preferred"; }), true);
    /* 3b. 自由任务再排（含暂停规则的固定任务，作为普通任务占位） */
    placeNonFixed(tasks.filter(function (t) { return !isActiveFixed(t) && t.mode !== "preferred"; }), false);

    function placeNonFixed(list, preferred) {
      sortTasks(list).forEach(function (t) {
        var soft = false;
        var from;
        if (preferred && t.prefStart) { from = parseMinutes(t.prefStart); soft = true; }
        else { from = parseMinutes(t.planStart.slice(11)); }
        if (from < earliest) from = earliest;           /* 不能排到过去 */
        var start = findFreeSlot(busy, from, t.duration, win.end);
        if (start === null) {
          /* 当天排不下：登记溢出，不排入时间线（不删任务） */
          overflow.push({ task: t, remain: t.duration, kind: "no-capacity" });
          return;
        }
        var end = start + t.duration;
        /* 缓冲计入 busy，保证任务之间留出 5–10 分钟间隔 */
        busy.push({ start: start, end: end + bufferMinutes() });
        slots.push({ task: t, start: start, end: end, fixed: false, soft: soft });
      });
    }

    return { slots: slots, busy: busy, dayStart: win.start, dayEnd: win.end, overflow: overflow };
  }

  /* 统一排期入口：返回某日期的排期结果 + 诊断（供渲染与时间不足方案使用） */
  function scheduleForDate(dateKey) {
    var tasks = collectTasks(dateKey);
    var result = computeSlots(tasks, dateKey);
    result.dateKey = dateKey;
    result.tasks = tasks;
    result.earliest = earliestMinute(dateKey);
    return result;
  }

  /* 只重排"未完成"任务的剩余时长：不删除任务、不覆盖已完成时间线。
     将未完成任务的 planStart 对齐到新排期结果，供后续渲染与持久化一致。 */
  function replanRemaining(dateKey) {
    var result = scheduleForDate(dateKey);
    result.slots.forEach(function (sl) {
      var t = sl.task;
      if (t.status === "done") return;                  /* 已完成冻结，不重排 */
      if (isActiveFixed(t)) return;                     /* 固定段由 fixedStart/End 决定 */
      t.planStart = t.planStart.slice(0, 10) + "T" + minutesToHHMM(sl.start);
    });
    return result;
  }

  /* ---- 时间不足时的方案（缩短 / 顺延 / 调整）----
     返回可选项数组，每项 { kind, taskId, taskTitle, label, detail, apply }。
     不自动应用：由用户点选后调用 apply 才写数据。 */
  function shortageOptions(dateKey) {
    var result = scheduleForDate(dateKey);
    var overflow = result.overflow || [];
    if (!overflow.length) return [];
    var options = [];
    var win = dayWindow();

    overflow.forEach(function (o) {
      var t = o.task;
      var title = t.title;

      /* 方案 1：缩短——把目标时长压到剩余可用容量以内（保留最小 10 分钟） */
      var shortened = Math.max(10, t.duration - o.remain);
      if (shortened < t.duration) {
        options.push({
          kind: "shorten", taskId: t.id, taskTitle: title,
          label: "缩短「" + title + "」",
          detail: "目标 " + t.duration + " → " + shortened + " 分钟",
          apply: function () {
            var task = findTask(t.id);
            if (!task) return;
            task.duration = shortened;
            task.estimated = false;
          }
        });
      }

      /* 方案 2：顺延——移到指定日期（默认次日） */
      var nextDay = shiftKey(dateKey, 1);
      options.push({
        kind: "postpone", taskId: t.id, taskTitle: title,
        label: "顺延「" + title + "」到 " + nextDay,
        detail: "移到次日重新排期",
        apply: function () {
          var task = findTask(t.id);
          if (!task) return;
          var from = bucketKeyOf(task.id);
          task.planStart = nextDay + "T" + task.planStart.slice(11);
          if (task.mode === "fixed" && task.fixedDate) task.fixedDate = nextDay;
          if (from && from !== nextDay) moveTaskDay(task.id, from, nextDay);
        }
      });

      /* 方案 3：调整——改固定为自由安排（或把偏好时间往后顺延），让引擎重新找位 */
      if (t.mode === "fixed") {
        options.push({
          kind: "adjust", taskId: t.id, taskTitle: title,
          label: "改为自由安排「" + title + "」",
          detail: "取消固定时段，由空闲时间自动安排",
          apply: function () {
            var task = findTask(t.id);
            if (!task) return;
            task.mode = "free";
            task.fixedStart = null;
            task.fixedEnd = null;
            task.fixedDate = null;
            task.repeat = "none";
            task.repeatDays = [];

          }
        });
      } else {
        options.push({
          kind: "adjust", taskId: t.id, taskTitle: title,
          label: "改为偏好时间「" + title + "」",
          detail: "保留软约束，尽量早排但不独占",
          apply: function () {
            var task = findTask(t.id);
            if (!task) return;
            task.mode = "preferred";
            task.prefStart = task.planStart.slice(11);
          }
        });
      }
    });

    return options;
  }

  /* 在时间不足方案的 apply 后统一收尾：重排 → 保存 → 渲染 */
  function finishShortage() {
    replanRemaining(state.date);
    save();
    render();
  }

  /* ---- 渲染时间不足方案面板：仅在当天排不下（overflow）时显示可选方案 ---- */
  function renderShortagePanel(dateKey) {
    var panel = $("shortagePanel");
    if (!panel) return;
    var opts = [];
    try { opts = shortageOptions(dateKey) || []; }
    catch (e) { console.error("[时间不足方案] 生成失败：", e); opts = []; }
    state._shortageOptions = opts;
    if (!opts.length) { panel.hidden = true; panel.innerHTML = ""; return; }
    panel.hidden = false;
    panel.innerHTML =
      '<div class="shortage-head">' +
        '<span class="shortage-title">时间不足</span>' +
        '<span class="shortage-sub">以下任务当天排不下，请选择处理方式</span>' +
      '</div>' +
      '<div class="shortage-list">' +
        opts.map(function (o, i) {
          return '<button class="shortage-option" type="button" data-shortage="' + i + '">' +
            '<span class="shortage-label">' + escapeHtml(o.label) + '</span>' +
            '<span class="shortage-detail">' + escapeHtml(o.detail || "") + '</span>' +
          '</button>';
        }).join("") +
      '</div>';
  }

  /* 应用某个时间不足方案并重新排期 */
  function applyShortageOption(index) {
    var opts = state._shortageOptions || [];
    var opt = opts[index];
    if (!opt || typeof opt.apply !== "function") { toast("方案已失效，请刷新重试", "error"); return; }
    opt.apply();
    replanRemaining(state.date);
    save();
    render();
    toast("已应用：" + opt.label, "ok");
  }

  function slotOf(slots, id) {
    for (var i = 0; i < slots.length; i++) {
      if (slots[i].task.id === id) return slots[i];
    }
    return null;
  }

  /* 取某任务的主段（固定任务优先取固定段，否则取第一段） */
  function primarySlot(slots, id) {
    var first = null;
    for (var i = 0; i < slots.length; i++) {
      if (slots[i].task.id !== id) continue;
      if (slots[i].fixed) return slots[i];
      if (!first) first = slots[i];
    }
    return first;
  }

  /* 取某任务的全部段 */
  function slotsOf(slots, id) {
    return slots.filter(function (s) { return s.task.id === id; });
  }

  /* 是否为固定任务（有合法固定时段） */
  function isFixedTask(t) {
    return t.mode === "fixed" && !!t.fixedStart && !!t.fixedEnd && parseMinutes(t.fixedEnd) > parseMinutes(t.fixedStart);
  }

  /* 是否为"生效中"的固定任务：固定且规则未被暂停（暂停后按普通任务处理） */
  function isActiveFixed(t) {
    return isFixedTask(t) && !t.rulePaused;
  }

  /* ---------------- Toast ---------------- */
  var toastTimer = null;
  function toast(msg, type) {
    var el = $("toast");
    el.textContent = msg;
    el.className = "toast show" + (type ? " " + type : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.className = "toast"; }, 2200);
  }

  function setHint(id, msg, type) {
    var el = $(id);
    if (!el) return;
    el.textContent = msg || "";
    el.className = "hint" + (type ? " " + type : "");
  }

  /* 报错时把提示滚动到可视区域，避免用户在长页面里看不到提示 */
  function scrollIntoViewSafe(el) {
    if (!el || typeof el.scrollIntoView !== "function") return;
    try {
      var rect = el.getBoundingClientRect();
      var vh = window.innerHeight || document.documentElement.clientHeight;
      if (rect.top < 0 || rect.bottom > vh) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    } catch (e) { /* 忽略滚动异常，不影响主流程 */ }
  }

  /* 高优错误提示：始终可见（原生弹窗）+ 页面内提示自动滚动到可视区 */
  function alertVisible(msg) {
    var el = $("newHint");
    if (el && state.view === "new") scrollIntoViewSafe(el);
    try { window.alert(msg); } catch (e) { /* 忽略 */ }
  }

  /* 统一的操作包装：任何异常都转成用户可见的提示，绝不静默失败 */
  function guard(fn, context) {
    return function () {
      try {
        return fn.apply(null, arguments);
      } catch (err) {
        var detail = err && err.message ? err.message : String(err);
        try { toast((context || "操作") + "失败：" + detail, "error"); } catch (e) { /* 忽略 */ }
        var hint = $("newHint");
        if (hint && state.view === "new") {
          setHint("newHint", (context || "操作") + "失败：" + detail, "error");
          scrollIntoViewSafe(hint);
        }
        try { console.error("[" + (context || "操作") + "] 失败：", err); } catch (e) { /* 忽略 */ }
        try { window.alert((context || "操作") + "失败：" + detail); } catch (e) { /* 忽略 */ }
      }
    };
  }

  /* ---------------- 视图切换 ---------------- */
  function switchView(view) {
    state.view = view;
    document.querySelectorAll(".view").forEach(function (v) {
      v.classList.toggle("is-active", v.id === "view-" + view);
    });
    document.querySelectorAll(".tab").forEach(function (t) {
      var active = t.dataset.view === view;
      t.classList.toggle("is-active", active);
      t.setAttribute("aria-selected", active ? "true" : "false");
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
    render();
  }

  function setDate(key) {
    state.date = key;
    render();
  }

  /* ---------------- 渲染：今日 ---------------- */
  function renderToday() {
    var schedule = scheduleForDate(state.date);
    var tasks = schedule.tasks;
    var slots = schedule.slots;
    renderShortagePanel(state.date);

    $("dateLabel").textContent = dateLabelText(state.date);
    $("dateWeek").textContent = weekLabel(state.date);
    $("todayPill").textContent = state.date === todayKey() ? "今天" : "回到今天";

    var plan = plannedMinutes(tasks);
    var doneTasks = tasks.filter(function (t) { return t.status === "done"; });
    var doneMin = doneTasks.reduce(function (s, t) { return s + Math.round(t.actual / 60); }, 0);

    $("sumPlan").textContent = fmtShort(plan);
    $("sumPlanCount").textContent = tasks.length + " 个任务";
    $("sumDone").textContent = fmtShort(doneMin);
    $("sumDoneCount").textContent = doneTasks.length + " 个任务";

    var cap = timelineCapacity();
    var free = cap - mealTotal() - plan - delayTotal(tasks) - bufferMinutes() * Math.max(0, tasks.length - 1);
    $("sumFree").textContent = fmtShort(free);
    $("sumFreeHint").textContent = free >= 0 ? "全天可用 " + fmtShort(cap) : "已超支 " + fmtShort(-free);

    var tl = $("timeline");
    if (!tasks.length) {
      tl.innerHTML = '<div class="empty"><p>这一天还没有任务。</p><p class="empty-sub">切到「新建」添加，或点击右上角回到今天。</p></div>';
    } else {
      tl.innerHTML = sortTodayTasks(tasks, slots).map(function (t) {
        var ps = primarySlot(slots, t.id);
        var cls = t.status === "done" ? "done" : (state.data.activeId === t.id ? "doing" : "");
        if (isActiveFixed(t)) cls += " fixed";
        var meta;
        if (isActiveFixed(t)) {
          var segs = slotsOf(slots, t.id).filter(function (s) { return s.isExtension; });
          meta = '<span class="fixed-range">固定 ' + t.fixedStart + '–' + t.fixedEnd + '</span>' +
            '<span>目标 ' + fmtShort(t.duration) + '</span>' +
            (segs.length ? '<span>剩余安排 ' + segs.map(function (s) { return minutesToHHMM(s.start) + '–' + minutesToHHMM(s.end); }).join('、') + '</span>' : '') +
            '<span class="status-tag ' + t.status + '">' + STATUS_TEXT[t.status] + '</span>';
        } else {
          meta = (ps
              ? '<span class="tl-dur">' + formatTimeRange(ps, t.duration) + '</span>'
              : '<span class="tl-noslot">时间未安排</span><span>目标 ' + fmtShort(t.duration) + '</span>') +
            (t.mode === "preferred" ? '<span>偏好 ' + t.prefStart + '</span>' : '') +
            (t.delay > 0 ? '<span>顺延 ' + t.delay + 'm</span>' : '') +
            '<span class="status-tag ' + t.status + '">' + STATUS_TEXT[t.status] + '</span>';
        }
        return '<div class="tl-item ' + cls + '">' +
          '<div class="tl-time">' + (ps ? minutesToHHMM(ps.start) : "待排") + '</div>' +
          '<div class="tl-body">' +
            '<div class="tl-title">' + escapeHtml(t.title) +
              (isActiveFixed(t) ? ' <span class="fixed-badge">固定</span>' : '') +
            '</div>' +
            '<div class="tl-meta">' + meta + '</div>' +
          '</div>' +
        '</div>';
      }).join("");
    }

    var list = $("taskList");
    $("taskCount").textContent = tasks.length + " 项";
    if (!tasks.length) {
      list.innerHTML = '<div class="empty"><p>暂无任务。</p><p class="empty-sub">支持一次输入多个任务，去「新建」试试。</p></div>';
      return;
    }
    list.innerHTML = sortTodayTasks(tasks, slots).map(function (t) {
      var ps = primarySlot(slots, t.id);
      var fixed = isActiveFixed(t);
      var segs = fixed ? slotsOf(slots, t.id).filter(function (s) { return s.isExtension; }) : [];
      var meta;
      if (fixed) {
        meta = '<span>固定 ' + t.fixedStart + '–' + t.fixedEnd + '</span>' +
          '<span>目标 ' + fmtShort(t.duration) + '</span>' +
          (segs.length ? '<span>剩余 ' + segs.map(function (s) { return minutesToHHMM(s.start) + '–' + minutesToHHMM(s.end); }).join('、') + '</span>' : '') +
          (t.actual > 0 ? '<span>实际 ' + fmtShort(t.actual / 60) + '</span>' : '');
      } else {
        meta = (ps
            ? '<span>计划 ' + minutesToHHMM(ps.start) + '</span><span class="tl-dur">' + formatTimeRange(ps, t.duration) + '</span>'
            : '<span class="tl-noslot">时间未安排</span><span>目标 ' + fmtShort(t.duration) + '</span>') +
          (t.mode === "preferred" ? '<span>偏好 ' + t.prefStart + '</span>' : '') +
          (t.actual > 0 ? '<span>实际 ' + fmtShort(t.actual / 60) + '</span>' : '');
      }
      return '<div class="task-item ' + (t.status === "done" ? "done" : "") + '">' +
        '<button class="task-check" data-act="toggle" data-id="' + t.id + '" title="标记完成/未完成">' + (t.status === "done" ? "✓" : "") + '</button>' +
        '<div class="task-main">' +
          '<div class="task-title">' + escapeHtml(t.title) +
            (fixed ? ' <span class="fixed-badge">固定</span>' : '') +
          '</div>' +
          '<div class="task-meta">' + meta +
            '<span class="status-tag ' + t.status + '">' + STATUS_TEXT[t.status] + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="task-actions">' +
          '<button class="mini-btn ok" data-act="run" data-id="' + t.id + '">执行</button>' +
          '<button class="mini-btn" data-act="edit" data-id="' + t.id + '">编辑</button>' +
          '<button class="mini-btn del" data-act="delete" data-id="' + t.id + '">删除</button>' +
        '</div>' +
      '</div>';
    }).join("");
  }

  /* 按展示起始时间排序（固定任务按其固定段起点） */
  function sortTodayTasks(tasks, slots) {
    return tasks.slice().sort(function (a, b) {
      var sa = primarySlot(slots, a.id);
      var sb = primarySlot(slots, b.id);
      return (sa ? sa.start : 99999) - (sb ? sb.start : 99999);
    });
  }

  /* ---------------- 新建：时长估算与表单读取 ---------------- */
  /* 自动估时：集中、可解释的保守估算；用户填写时长时以用户值为准 */
  function estimateDuration(title) {
    var text = String(title || "").toLowerCase();
    var base = 30;
    if (/会|培训|上课|考试|面试|课程/.test(text)) base = 60;
    else if (/写|文档|报告|周报|方案|设计|论文|总结|复盘/.test(text)) base = 45;
    else if (/邮件|回复|整理|检查|确认|提交|缴费|预约|挂号|报名/.test(text)) base = 15;
    if (text.trim().length >= 14) base += 15;
    base = Math.max(10, Math.min(180, base));
    return Math.round(base / 5) * 5;
  }

  /* 把全角数字/符号转为半角，便于统一解析用户输入 */
  function toHalfWidth(str) {
    return String(str).replace(/[\uFF01-\uFF5E]/g, function (c) {
      return String.fromCharCode(c.charCodeAt(0) - 0xFEE0);
    }).replace(/\u3000/g, " ");
  }

  /* 归一化单个时长片段：去空白/零宽等不可见字符，全角转半角，去除「分钟」等后缀 */
  function cleanDurationToken(value) {
    var s = toHalfWidth(value == null ? "" : value);
    s = s.replace(/[\s\u200B-\u200D\uFEFF]+/g, "");
    s = s.replace(/(分钟|分|min|mins|minutes|m)$/i, "");
    return s;
  }

  /* 解析目标时长：留空 → 自动估时；填写非法 → 返回错误 */
  function resolveDuration(rawValue, title) {
    var raw = String(rawValue == null ? "" : rawValue).replace(/[\s\u200B-\u200D\uFEFF]+/g, "");
    if (raw === "") return { minutes: estimateDuration(title), estimated: true };
    var n = Number(cleanDurationToken(raw));
    if (!isFinite(n) || n < 5) {
      return { error: "目标时长「" + String(rawValue).trim() + "」需为不小于 5 的分钟数，或留空自动估算。" };
    }
    return { minutes: Math.round(n), estimated: false };
  }

  /* 拆分批量时长输入：支持英文/中文逗号、顿号、分号、换行、连续空格 */
  function splitDurations(rawValue) {
    var s = toHalfWidth(rawValue == null ? "" : rawValue);
    return s.split(/[,，、;；\s]+/).map(function (x) {
      return x.replace(/[\u200B-\u200D\uFEFF]+/g, "");
    }).filter(function (x) { return x.length > 0; });
  }

  /* 规范化时间范围展示：「21:31 – 22:16 · 45 分钟」；无排期返回空串 */
  function formatTimeRange(slot, duration) {
    if (!slot) return "";
    var base = minutesToHHMM(slot.start) + " – " + minutesToHHMM(slot.end);
    var dur = Number(duration);
    if (isFinite(dur) && dur > 0) base += " · " + Math.round(dur) + " 分钟";
    return base;
  }

  /* 星期多选：读取 / 回填 / 显隐 */
  function repeatDaysOf(containerId) {
    var box = $(containerId);
    if (!box) return [];
    var out = [];
    box.querySelectorAll("input[type=checkbox]").forEach(function (c) {
      if (c.checked) out.push(Number(c.value));
    });
    return out;
  }

  function setRepeatDays(containerId, days) {
    var box = $(containerId);
    if (!box) return;
    var set = {};
    (days || []).forEach(function (d) { set[Number(d)] = true; });
    box.querySelectorAll("input[type=checkbox]").forEach(function (c) {
      c.checked = !!set[Number(c.value)];
    });
  }

  function syncRepeatDaysUI(selectId, containerId) {
    var sel = $(selectId);
    var box = $(containerId);
    if (!sel || !box) return;
    var isCustom = sel.value === "custom";
    box.hidden = !isCustom;
    /* 非自定义规则下必须取消全部勾选，避免残留旧选择被误用 */
    if (!isCustom) setRepeatDays(containerId, []);
  }

  function renderNewModeUI() {
    var mode = $("newMode").value;
    $("newFreeBox").hidden = mode !== "free";
    $("newPreferredBox").hidden = mode !== "preferred";
    $("newFixedBox").hidden = mode !== "fixed";
    if (!$("newDate").value) $("newDate").value = state.date;
    $("newDateHint").textContent = "将安排到 " + $("newDate").value;
    syncRepeatDaysUI("newFixedRepeat", "newFixedRepeatDays");
    if (mode === "fixed" && !$("newHint").dataset.touched) {
      setHint("newHint", "固定时间模式：请只输入一个任务（固定时间无法批量占位）。", "");
    } else if (mode !== "fixed" && !$("newHint").dataset.touched) {
      setHint("newHint", "当前将添加到：" + $("newDate").value + "（" + weekLabel($("newDate").value) + "）", "");
    }
  }

  /* ---------------- 新建 ---------------- */
  function renderNew() {
    renderNewModeUI();
    if (!$("newHint").dataset.touched) {
      var d = $("newDate").value || state.date;
      setHint("newHint", "当前将添加到：" + d + "（" + weekLabel(d) + "）", "");
    }
  }

  /* 读取固定时间表单，返回 {start,end,date,repeat,repeatDays} 或 {error} */
  function readFixedForm(prefix, dateFallback) {
    var fields = prefix === "new"
      ? { start: "newFixedStart", end: "newFixedEnd", date: "newDate", repeat: "newFixedRepeat", days: "newFixedRepeatDays" }
      : { start: "editFixedStart", end: "editFixedEnd", date: "editDate", repeat: "editFixedRepeat", days: "editFixedRepeatDays" };
    var start = $(fields.start).value;
    var end = $(fields.end).value;
    var date = $(fields.date).value || dateFallback;
    var repeat = $(fields.repeat).value || "none";
    var repeatDays = repeat === "custom" ? repeatDaysOf(fields.days) : [];
    if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) {
      return { error: "请填写开始与结束时间（24 小时制，如 15:00）。" };
    }
    if (parseMinutes(end) <= parseMinutes(start)) {
      return { error: "结束时间必须晚于开始时间（同一天内）。" };
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return { error: "请选择固定日期。" };
    }
    if (repeat === "custom" && !repeatDays.length) {
      return { error: "自定义重复：请至少选择一天。" };
    }
    return { start: start, end: end, date: date, repeat: repeat, repeatDays: repeatDays };
  }

  /* ---------------- 渲染：执行 ---------------- */
  function renderRun() {
    var dayKey = state.date;
    if (state.data.activeId) {
      var a = findTask(state.data.activeId);
      if (a) dayKey = dayKeyOf(a);
    }
    var tasks = collectTasks(dayKey);
    $("runDateHint").textContent = dayKey + "（" + weekLabel(dayKey) + "）";

    var sel = $("runTaskSelect");
    if (!tasks.length) {
      sel.innerHTML = '<option value="">暂无任务</option>';
      sel.disabled = true;
    } else {
      sel.disabled = false;
      var sorted = sortTasks(tasks);
      var currentId = state.runId || state.data.activeId;
      if (!sorted.some(function (t) { return t.id === currentId; })) currentId = sorted[0].id;
      state.runId = currentId;
      sel.innerHTML = sorted.map(function (t) {
        return '<option value="' + t.id + '"' + (t.id === currentId ? " selected" : "") + '>' +
          escapeHtml(t.title) + '（' + STATUS_TEXT[t.status] + '）</option>';
      }).join("");
    }

    var task = state.runId ? findTask(state.runId) : null;
    var empty = $("runEmpty");
    var card = $("runCard");

    if (!task) {
      empty.hidden = false;
      card.hidden = true;
      renderInterrupts(null);
      renderRunNotes(null);
      return;
    }
    empty.hidden = true;
    card.hidden = false;

    var elapsed = currentElapsed(task);
    $("runStatus").textContent = STATUS_TEXT[task.status];
    $("runStatus").className = "run-status " + (task.status === "doing" ? "doing" : task.status === "paused" ? "paused" : task.status === "done" ? "done" : "");
    $("runTitle").textContent = task.title;
    $("runTimer").textContent = fmtTimer(elapsed);
    $("runPlan").textContent = task.duration;
    $("runDelay").textContent = task.delay || 0;
    $("runInterrupt").textContent = task.interrupts.length;
    var remainEl = $("runRemain");
    if (remainEl) remainEl.textContent = taskRemainingMinutes(task);

    var isDoing = task.status === "doing";
    var isPaused = task.status === "paused";
    var isPending = task.status === "pending";
    var isDone = task.status === "done";

    $("btnStart").disabled = !isPending;
    $("btnStart").textContent = isPending ? "开始" : "已开始";
    $("btnPause").disabled = !isDoing;
    $("btnResume").disabled = !isPaused;
    $("btnBreak").disabled = !isDoing;
    $("btnComplete").disabled = isDone;
    $("btnComplete").textContent = isDone ? "已完成" : "完成";

    /* 未确认的离开区间：显示提示，等待用户在弹出的确认框中处理 */
    if (task.pendingGapStart && state.leaveFlow && state.leaveFlow.taskId === task.id) {
      var pendSec = safeSeconds(secondsBetween(task.pendingGapStart, task.pendingGapEnd || Date.now()));
      $("runStatus").textContent = "离开 " + fmtLeaveSpan(pendSec) + "，待确认";
    } else if (isPaused && task.interruptedAt) {
      /* 离开提醒（已暂停） */
      var away = (Date.now() - task.interruptedAt) / 60000;
      var th = leaveThresholdMinutes();
      if (away >= th) {
        $("runStatus").textContent = "已暂停 · 离开 " + Math.round(away) + " 分钟";
      }
    }

    renderInterrupts(task);
    renderRunNotes(task);
    ensureTick();
  }

  /* 渲染执行页的进度备注：下次继续位置 + 备注列表 */
  function renderRunNotes(task) {
    var empty = $("runNoteEmpty");
    var card = $("runNoteCard");
    if (!empty || !card) return;
    if (!task) {
      empty.hidden = false;
      card.hidden = true;
      renderNoteList($("runNoteList"), null);
      return;
    }
    empty.hidden = true;
    card.hidden = false;
    var resumeEl = $("runResumeFrom");
    if (resumeEl && document.activeElement !== resumeEl) resumeEl.value = task.resumeFrom || "";
    renderNoteList($("runNoteList"), task);
  }

  function renderNoteList(el, task) {
    if (!el) return;
    var notes = task && Array.isArray(task.notes) ? task.notes : [];
    if (!notes.length) {
      el.innerHTML = '<p class="note-empty">还没有备注。可在暂停或中断时记录进度，方便下次继续。</p>';
      return;
    }
    el.innerHTML = notes.slice().reverse().map(function (n) {
      return '<div class="note-item">' +
        '<span class="note-time">' + fmtClock(n.at) + '</span>' +
        '<span class="note-text">' + escapeHtml(n.text) + '</span>' +
      '</div>';
    }).join("");
  }

  /* 保存当前任务的进度备注与下次继续位置 */
  function saveRunNote() {
    var task = state.runId ? findTask(state.runId) : null;
    if (!task) { toast("请先选择一个任务", "error"); return; }
    var resumeEl = $("runResumeFrom");
    var inputEl = $("runNoteInput");
    var text = inputEl ? inputEl.value.trim() : "";
    var resume = resumeEl ? resumeEl.value.trim() : "";
    task.resumeFrom = resume;
    if (!text && !resume) { toast("请填写进度备注或下次继续位置", "error"); return; }
    if (text) {
      task.notes = Array.isArray(task.notes) ? task.notes : [];
      task.notes.push({ text: text, at: Date.now() });
      if (inputEl) inputEl.value = "";
    }
    save();
    renderRunNotes(task);
    toast("已保存备注", "ok");
  }

  function renderInterrupts(task) {
    var el = $("interruptList");
    if (!task || !task.interrupts.length) {
      $("interruptCount").textContent = "0 条";
      el.innerHTML = '<div class="empty"><p>暂无中断记录。</p><p class="empty-sub">执行中点击「记录中断」可添加。</p></div>';
      return;
    }
    $("interruptCount").textContent = task.interrupts.length + " 条";
    el.innerHTML = task.interrupts.slice().reverse().map(function (it) {
      var dur = it.end ? Math.round((it.end - it.start) / 60000) + " 分钟" : "进行中";
      var tag = it.counted === true ? '<span class="it-tag counted">计入</span>'
        : it.counted === false ? '<span class="it-tag uncounted">不计入</span>' : '';
      return '<div class="interrupt-item">' +
        '<span class="it-reason">' + tag + escapeHtml(it.reason || "未填写原因") + '</span>' +
        '<span class="it-time">' + fmtClock(it.start) + ' · ' + dur + '</span>' +
      '</div>';
    }).join("");
  }

  /* ---------------- 渲染：复盘 ---------------- */
  /* 复盘筛选状态：all / done / undone / interrupt / delayed */
  var reviewFilter = "all";

  /* 中断总时长（分钟）：已结束取实际区间，未结束按到当前计 */
  function interruptMinutes(tasks) {
    var ms = 0;
    tasks.forEach(function (t) {
      (t.interrupts || []).forEach(function (it) {
        var end = it.end || (t.interruptedAt || Date.now());
        ms += Math.max(0, end - it.start);
      });
    });
    return Math.round(ms / 60000);
  }

  function reviewFilterMatch(t, filter) {
    if (filter === "done") return t.status === "done";
    if (filter === "undone") return t.status !== "done";
    if (filter === "interrupt") return (t.interrupts || []).length > 0;
    if (filter === "delayed") return (Number(t.delay) || 0) > 0;
    return true;
  }

  function renderReview() {
    var tasks = collectTasks(state.date);
    $("reviewDateHint").textContent = state.date + "（" + weekLabel(state.date) + "）";

    var plan = plannedMinutes(tasks);
    var actual = tasks.reduce(function (s, t) { return s + t.actual; }, 0) / 60;
    var interrupts = tasks.reduce(function (s, t) { return s + t.interrupts.length; }, 0);
    var delay = delayTotal(tasks);
    var intMin = interruptMinutes(tasks);
    var doneTasks = tasks.filter(function (t) { return t.status === "done"; });
    var rate = plan > 0 ? Math.min(100, Math.round((actual / plan) * 100)) : (actual > 0 ? 100 : 0);
    var deviation = Math.round(actual - plan);

    $("revPlan").textContent = fmtShort(plan);
    $("revActual").textContent = fmtShort(actual);
    $("revInterrupt").textContent = interrupts;
    $("revDelay").textContent = fmtShort(delay);
    $("revRate").textContent = rate + "%";
    $("revInterruptMin").textContent = fmtShort(intMin);
    $("revDoneCount").textContent = doneTasks.length + " / " + tasks.length + " 个";
    $("revDeviation").textContent = (deviation >= 0 ? "+" : "") + fmtShort(Math.abs(deviation));

    /* 状态分布 */
    var dist = { pending: 0, doing: 0, paused: 0, done: 0 };
    tasks.forEach(function (t) { if (dist[t.status] != null) dist[t.status]++; });
    var distEl = $("revDist");
    if (distEl) {
      distEl.innerHTML = ["pending", "doing", "paused", "done"].map(function (k) {
        return '<div class="dist-item"><span class="dist-num">' + dist[k] + '</span>' +
          '<span class="dist-label">' + STATUS_TEXT[k] + '</span></div>';
      }).join("");
    }

    /* 完成率进度条（全局比例，允许保留） */
    var rateBar = $("revRateBar");
    if (rateBar) {
      var rp = plan > 0 ? Math.min(100, (actual / plan) * 100) : (actual > 0 ? 100 : 0);
      rateBar.innerHTML = '<span style="width:' + (isFinite(rp) ? rp.toFixed(1) : 0) + '%"></span>';
    }

    var el = $("reviewList");
    if (!tasks.length) {
      el.innerHTML = '<div class="empty"><p>这一天没有可复盘的数据。</p><p class="empty-sub">完成一些任务后再回来看看。</p></div>';
      return;
    }
    var filtered = sortTasks(tasks).filter(function (t) { return reviewFilterMatch(t, reviewFilter); });
    if (!filtered.length) {
      el.innerHTML = '<div class="empty"><p>当前筛选下没有任务。</p><p class="empty-sub">试试切换到「全部」或选择其他筛选条件。</p></div>';
      return;
    }
    el.innerHTML = filtered.map(function (t) {
      return reviewCard(t);
    }).join("");
  }

  /* 复盘状态归类：pending/doing/paused 原样返回；done 细分为 over/early/ontime */
  function reviewStatusKind(status, duration, actualSec) {
    if (status !== "done") return status;
    var actMin = Math.round(actualSec / 60);
    var ratio = duration > 0 ? actMin / duration : (actMin > 0 ? Infinity : 1);
    if (ratio > 1.1) return "over";
    if (ratio < 0.9) return "early";
    return "ontime";
  }

  function reviewCard(t) {
    var planned = t.duration;
    var actMin = Math.round(t.actual / 60);
    /* 每张卡片独立计算比例，不使用全局 maxMin */
    var pct = planned > 0 ? Math.min(100, (actMin / planned) * 100) : 0;
    var roundedPct = Math.round(pct);
    var kind = reviewStatusKind(t.status, planned, t.actual);

    var badge;
    if (kind === "over") badge = '<span class="review-badge over">超时</span>';
    else if (kind === "early") badge = '<span class="review-badge done">提前完成</span>';
    else if (kind === "ontime") badge = '<span class="review-badge done">按时完成</span>';
    else if (kind === "doing") badge = '<span class="review-badge">进行中 · 当前完成 ' + roundedPct + '%</span>';
    else if (kind === "paused") badge = '<span class="review-badge">已暂停 · 当前完成 ' + roundedPct + '%</span>';
    else badge = '<span class="review-badge">待开始</span>';

    /* 待开始不显示时长差；已完成按提前/按时/超时给出差值 */
    var diffText = "";
    if (kind === "over") diffText = "超出 " + (actMin - planned) + " 分钟";
    else if (kind === "early") diffText = "提前 " + (planned - actMin) + " 分钟";
    else if (kind === "ontime") diffText = "按时完成";

    var noteHtml = "";
    if (t.resumeFrom || (t.notes && t.notes.length)) {
      noteHtml = '<div class="review-notes">' +
        (t.resumeFrom ? '<div class="note-resume">下次继续：' + escapeHtml(t.resumeFrom) + '</div>' : '') +
        (t.notes && t.notes.length
          ? t.notes.slice().reverse().map(function (n) {
              return '<div class="note-item"><span class="note-time">' + fmtClock(n.at) + '</span><span class="note-text">' + escapeHtml(n.text) + '</span></div>';
            }).join("")
          : '') +
      '</div>';
    }

    return '<div class="review-item">' +
      '<div class="review-top">' +
        '<span class="review-title">' + escapeHtml(t.title) +
          (isActiveFixed(t) ? ' <span class="fixed-badge">固定</span>' : '') +
        '</span>' + badge +
      '</div>' +
      '<div class="review-bars">' +
        barRow("目标", planned, 100, "plan", false) +
        barRow("实际", actMin, pct, "actual", kind === "over") +
      '</div>' +
      '<div class="task-meta" style="margin-top:8px">' +
        (isFixedTask(t) ? '<span>固定 ' + t.fixedStart + '–' + t.fixedEnd + '</span>' : '') +
        '<span>中断 ' + t.interrupts.length + ' 次</span>' +
        '<span>顺延 ' + (t.delay || 0) + ' 分钟</span>' +
        (diffText ? '<span>' + diffText + '</span>' : '') +
      '</div>' +
      noteHtml +
    '</div>';
  }

  /* ---------------- 渲染：历史记录 ---------------- */
  /* 汇总某天（含该天生效的固定任务）的复盘指标 */
  function daySummary(dateKey) {
    var tasks = collectTasks(dateKey);
    var plan = plannedMinutes(tasks);
    var actual = Math.round(tasks.reduce(function (s, t) { return s + t.actual; }, 0) / 60);
    var rate = plan > 0 ? Math.min(100, Math.round((actual / plan) * 100)) : (actual > 0 ? 100 : 0);
    return { key: dateKey, count: tasks.length, plan: plan, actual: actual, rate: rate, tasks: tasks };
  }

  /* 有任务的日期列表，按日期倒序 */
  function historyDates() {
    return Object.keys(state.data.days).filter(function (k) {
      return (state.data.days[k] || []).length > 0;
    }).sort(function (a, b) { return a < b ? 1 : a > b ? -1 : 0; });
  }

  function renderHistory() {
    var el = $("historyList");
    if (!el) return;
    var dates = historyDates();
    var countEl = $("historyCount");
    if (countEl) countEl.textContent = dates.length + " 天";
    if (!dates.length) {
      el.innerHTML = '<div class="empty"><p>暂无历史记录。</p><p class="empty-sub">添加任务后这里会按日期汇总你的计划与执行。</p></div>';
      return;
    }
    el.innerHTML = dates.map(function (k) {
      var s = daySummary(k);
      var isActive = k === state.date;
      return '<button class="history-item' + (isActive ? ' is-active' : '') + '" type="button" data-date="' + k + '">' +
        '<span class="history-date">' + k + '<small>' + weekLabel(k) + '</small></span>' +
        '<span class="history-stats">' +
          '<span>计划 ' + fmtShort(s.plan) + '</span>' +
          '<span>实际 ' + fmtShort(s.actual) + '</span>' +
          '<span class="history-rate">' + s.rate + '%</span>' +
          '<span>' + s.count + ' 个</span>' +
        '</span>' +
      '</button>';
    }).join("");
  }

  function renderHistoryDetail() {
    var el = $("historyDetailBox");
    if (!el) return;
    var s = daySummary(state.date);
    var tasks = sortTasks(s.tasks);
    var head = '<div class="history-detail-head">' +
      '<strong>' + state.date + '（' + weekLabel(state.date) + '）</strong>' +
      '<span class="panel-hint">计划 ' + fmtShort(s.plan) + ' · 实际 ' + fmtShort(s.actual) + ' · 完成率 ' + s.rate + '% · ' + s.count + ' 个任务</span>' +
    '</div>';
    if (!tasks.length) {
      el.innerHTML = head + '<div class="empty"><p>这一天没有任务。</p></div>';
      return;
    }
    el.innerHTML = head + tasks.map(function (t) {
      var actMin = Math.round(t.actual / 60);
      var intCount = t.interrupts.length;
      return '<div class="history-task">' +
        '<div class="history-task-top">' +
          '<span class="history-task-title">' + escapeHtml(t.title) + '</span>' +
          '<span class="status-tag ' + t.status + '">' + STATUS_TEXT[t.status] + '</span>' +
        '</div>' +
        '<div class="task-meta">' +
          '<span>计划 ' + t.duration + ' 分钟</span>' +
          '<span>实际 ' + actMin + ' 分钟</span>' +
          (intCount ? '<span>中断 ' + intCount + ' 次</span>' : '') +
          ((t.delay || 0) > 0 ? '<span>顺延 ' + t.delay + ' 分钟</span>' : '') +
        '</div>' +
        ((t.resumeFrom || (t.notes && t.notes.length))
          ? '<div class="review-notes">' +
              (t.resumeFrom ? '<div class="note-resume">下次继续：' + escapeHtml(t.resumeFrom) + '</div>' : '') +
              (t.notes || []).slice().reverse().map(function (n) {
                return '<div class="note-item"><span class="note-time">' + fmtClock(n.at) + '</span><span class="note-text">' + escapeHtml(n.text) + '</span></div>';
              }).join("") +
            '</div>'
          : '') +
      '</div>';
    }).join("");
  }

  /* 进度条：目标条固定 100%，实际条按该任务自身目标计算；右侧同时显示分钟数与百分比 */
  function barRow(label, minutes, pct, cls, over) {
    var safePct = isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0;
    var safeMin = isFinite(minutes) ? Math.max(0, Math.round(minutes)) : 0;
    return '<div class="review-bar-row">' +
      '<span class="bar-label">' + label + '</span>' +
      '<span class="review-bar ' + cls + (over ? ' over' : '') + '"><span style="width:' + safePct.toFixed(1) + '%"></span></span>' +
      '<span class="bar-value">' + safeMin + ' 分钟 · ' + Math.round(safePct) + '%</span>' +
    '</div>';
  }

  /* ---------------- 渲染：设置 ---------------- */
  function renderSettings() {
    var s = state.data.settings;
    $("setSleepStart").value = s.sleepStart;
    $("setSleepEnd").value = s.sleepEnd;
    $("setBreakfast").value = s.breakfast;
    $("setLunch").value = s.lunch;
    $("setDinner").value = s.dinner;
    $("setMealDuration").value = s.mealDuration;
    $("setBreakBuffer").value = s.breakBuffer;
    $("setLeaveThreshold").value = s.leaveThreshold;
    renderFixedBlocks();
    renderRules();
  }

  function weekdayCheckboxes(days, role) {
    var names = ["日", "一", "二", "三", "四", "五", "六"];
    var set = {};
    (days || []).forEach(function (d) { set[Number(d)] = true; });
    return [1, 2, 3, 4, 5, 6, 0].map(function (v) {
      return '<label><input type="checkbox" data-role="' + role + '" value="' + v + '"' +
        (set[v] ? " checked" : "") + ' />' + names[v] + '</label>';
    }).join("");
  }

  function renderFixedBlocks() {
    var list = state.data.settings.fixedBlocks || [];
    $("fixedBlocksCount").textContent = list.length + " 条";
    var box = $("fixedBlocksList");
    if (!list.length) {
      box.innerHTML = '<p class="field-help">暂无固定占用。可添加「上课」「通勤」等时段。</p>';
      return;
    }
    box.innerHTML = list.map(function (b) {
      var label = escapeHtml(b.label);
      return '<div class="fixed-block" data-id="' + b.id + '">' +
        '<input class="fb-label" type="text" maxlength="20" value="' + label + '" placeholder="名称，如 上课 / 通勤" aria-label="固定占用名称" />' +
        '<div class="fb-times">' +
          '<input class="fb-start" type="time" value="' + b.start + '" aria-label="固定占用开始时间" />' +
          '<span class="fb-dash" aria-hidden="true">–</span>' +
          '<input class="fb-end" type="time" value="' + b.end + '" aria-label="固定占用结束时间" />' +
          '<button class="btn ghost fb-remove" type="button" data-act="remove" aria-label="删除固定占用：' + label + '">删除</button>' +
        '</div>' +
        '<div class="weekday-picker" role="group" aria-label="固定占用生效星期">' + weekdayCheckboxes(b.days, "fb-day") + '</div>' +
      '</div>';
    }).join("");
  }

  function collectFixedBlocks() {
    var blocks = [];
    $("fixedBlocksList").querySelectorAll(".fixed-block").forEach(function (el) {
      var labelEl = el.querySelector(".fb-label");
      var startEl = el.querySelector(".fb-start");
      var endEl = el.querySelector(".fb-end");
      if (!labelEl || !startEl || !endEl) return;
      var start = startEl.value;
      var end = endEl.value;
      if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return;
      if (parseMinutes(end) <= parseMinutes(start)) return;
      var days = [];
      el.querySelectorAll('input[data-role="fb-day"]').forEach(function (c) {
        if (c.checked) days.push(Number(c.value));
      });
      blocks.push({ id: el.dataset.id || uid(), label: labelEl.value.trim() || "固定占用", start: start, end: end, days: days });
    });
    state.data.settings.fixedBlocks = blocks;
    save();
  }

  /* ---------------- 时间规则表（固定 / 偏好任务集中管理） ---------------- */

  /* 参与规则表的任务：固定时间或偏好时间类型 */
  function ruleTasks() {
    return allTasks().filter(function (t) {
      return t.mode === "fixed" || t.mode === "preferred";
    });
  }

  function repeatSummary(t) {
    var text = REPEAT_TEXT[t.repeat] || "仅今天";
    if (t.repeat === "custom") {
      var names = ["日", "一", "二", "三", "四", "五", "六"];
      var days = Array.isArray(t.repeatDays) ? t.repeatDays.slice().sort(function (a, b) { return a - b; }) : [];
      if (days.length) text += "（周" + days.map(function (d) { return names[d]; }).join("、") + "）";
    }
    return text;
  }

  function ruleTimeText(t) {
    if (t.mode === "fixed") return (t.fixedStart || "--") + " – " + (t.fixedEnd || "--");
    return (t.prefStart || "--") + " 起";
  }

  function renderRules() {
    var list = ruleTasks();
    $("rulesCount").textContent = list.length + " 条";
    var box = $("rulesList");
    if (!list.length) {
      box.innerHTML = '<div class="empty"><p>还没有固定或偏好时间规则。</p><p class="empty-sub">可在下方点「新建时间规则」，或在「新建」页创建固定 / 偏好任务。</p></div>';
      return;
    }
    box.innerHTML = list.map(function (t) {
      var rulePaused = !!t.rulePaused;
      var name = escapeHtml(t.title);
      return '<div class="rule-item' + (rulePaused ? ' is-paused' : '') + '" data-id="' + t.id + '">' +
        '<div class="rule-head">' +
          '<span class="rule-title">' + name + '</span>' +
          '<span class="rule-type ' + (t.mode === 'fixed' ? 'fixed' : 'preferred') + '">' + (MODE_TEXT[t.mode] || t.mode) + '</span>' +
        '</div>' +
        '<div class="rule-meta">' +
          '<span>时间 ' + ruleTimeText(t) + '</span>' +
          '<span>日期 ' + dayKeyOf(t) + '</span>' +
          '<span>重复 ' + repeatSummary(t) + '</span>' +
          '<span>状态 ' + STATUS_TEXT[t.status] + '</span>' +
          '<span class="rule-status ' + (rulePaused ? 'paused' : 'active') + '">' + (rulePaused ? '已暂停规则' : '生效中') + '</span>' +
        '</div>' +
        '<div class="rule-actions">' +
          '<button class="btn ghost" type="button" data-act="edit" aria-label="编辑规则：' + name + '">编辑</button>' +
          '<button class="btn ghost" type="button" data-act="replace" aria-label="替换任务：' + name + '">替换任务</button>' +
          '<button class="btn ghost" type="button" data-act="' + (rulePaused ? 'resume' : 'pause') + '" aria-label="' + (rulePaused ? '恢复规则：' : '暂停规则：') + name + '">' + (rulePaused ? '恢复规则' : '暂停规则') + '</button>' +
          '<button class="btn danger" type="button" data-act="delete" aria-label="删除规则：' + name + '">删除</button>' +
        '</div>' +
      '</div>';
    }).join("");
  }

  /* 暂停/恢复规则：仅切换占用，不改变任务本身（仍可执行、不被删除） */
  function toggleRulePause(id) {
    var t = findTask(id);
    if (!t) { toast("任务不存在", "error"); return; }
    t.rulePaused = !t.rulePaused;
    save();
    replanRemaining(state.date);   /* 规则变化立即重排当前日期 */
    save();
    render();
    renderRules();
    toast(t.rulePaused ? "已暂停规则：" + t.title : "已恢复规则：" + t.title, "ok");
  }

  function deleteRule(id) {
    var t = findTask(id);
    if (!t) { toast("任务不存在", "error"); return; }
    if (!window.confirm("确定删除规则「" + t.title + "」吗？该任务将被一并删除，且不可恢复。")) return;
    removeTask(id);
    if (state.data.activeId === id) state.data.activeId = null;
    if (state.runId === id) state.runId = null;
    save();
    replanRemaining(state.date);   /* 删除规则后立即重排 */
    save();
    render();
    renderRules();
    toast("已删除规则：" + t.title, "ok");
  }

  /* ---- 弹窗焦点管理：打开时聚焦首个可聚焦元素，关闭时回落到触发元素 ---- */
  var lastFocusEl = null;

  function focusables(modal) {
    var sel = 'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return Array.prototype.slice.call(modal.querySelectorAll(sel)).filter(function (el) {
      return el.offsetParent !== null || el === document.activeElement;
    });
  }

  function trapFocus(e, modal) {
    if (e.key !== "Tab") return;
    var items = focusables(modal);
    if (!items.length) return;
    var first = items[0];
    var last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* 打开弹窗：记录触发元素、显示、聚焦首个可聚焦元素 */
  function showModal(modal) {
    lastFocusEl = document.activeElement;
    modal.hidden = false;
    var items = focusables(modal);
    if (items.length) items[0].focus();
    else { modal.setAttribute("tabindex", "-1"); modal.focus(); }
  }

  /* 关闭弹窗：隐藏并把焦点还给触发元素 */
  function hideModal(modal) {
    modal.hidden = true;
    if (lastFocusEl && typeof lastFocusEl.focus === "function" && document.contains(lastFocusEl)) {
      lastFocusEl.focus();
    }
    lastFocusEl = null;
  }

  /* ---- 替换任务：让另一个（或新建）任务接管原固定 / 偏好时间 ---- */
  var replacingId = null;

  function openReplace(id) {
    var t = findTask(id);
    if (!t) { toast("任务不存在", "error"); return; }
    replacingId = id;
    var opts = ['<option value="">（不选择，改用下方新名称）</option>'];
    allTasks().forEach(function (o) {
      if (o.id === id) return;
      opts.push('<option value="' + o.id + '">' + escapeHtml(o.title) + '（' + (MODE_TEXT[o.mode] || o.mode) + '）</option>');
    });
    $("replaceExisting").innerHTML = opts.join("");
    $("replaceNewTitle").value = "";
    setHint("replaceHint", "将把「" + t.title + "」的" + (t.mode === "fixed" ? "固定" : "偏好") + "时间交给新任务接管。", "");
    showModal($("replaceModal"));
  }

  function closeReplace() {
    replacingId = null;
    hideModal($("replaceModal"));
  }

  function applyReplace() {
    var src = replacingId ? findTask(replacingId) : null;
    if (!src) { setHint("replaceHint", "原任务不存在。", "error"); toast("替换失败", "error"); closeReplace(); return; }

    var existingId = $("replaceExisting").value;
    var newTitle = $("replaceNewTitle").value.trim();
    var target = null;

    if (existingId) {
      target = findTask(existingId);
      if (!target) { setHint("replaceHint", "所选任务不存在。", "error"); toast("替换失败", "error"); return; }
      if (target.mode === "fixed" || target.mode === "preferred") {
        setHint("replaceHint", "所选任务本身已占用固定 / 偏好时间，请改选一个自由任务或输入新名称。", "error");
        toast("所选任务已占用时间", "error");
        return;
      }
    } else if (newTitle) {
      if (allTasks().some(function (o) { return o.title === newTitle; })) {
        setHint("replaceHint", "已存在同名任务「" + newTitle + "」，请换一个名称或直接选择它。", "error");
        toast("任务名称重复", "error");
        return;
      }
      target = baseTask();
      target.title = newTitle;
      target.mode = "free";
      getDay(dayKeyOf(src)).push(target);
    } else {
      setHint("replaceHint", "请选择一个已有任务，或输入一个新任务名称。", "error");
      toast("未选择替换对象", "error");
      return;
    }

    /* 目标接管源任务的时间约束；若为固定任务需先做冲突检测 */
    var targetDate = dayKeyOf(src);
    if (src.mode === "fixed") {
      var conflict = fixedConflict(src.fixedStart, src.fixedEnd, collectTasks(targetDate), target.id, targetDate);
      if (conflict) {
        setHint("replaceHint", "无法替换：" + conflict + "。请先处理冲突或改用其他时段。", "error");
        toast("替换冲突，未生效", "error");
        return;
      }
      target.mode = "fixed";
      target.fixedStart = src.fixedStart;
      target.fixedEnd = src.fixedEnd;
      target.fixedDate = src.fixedDate || targetDate;
      target.repeat = src.repeat;
      target.repeatDays = (src.repeatDays || []).slice();
      target.duration = src.duration;
      target.planStart = (target.fixedDate) + "T" + src.fixedStart;
      /* 目标换日期时移动所属分组 */
      var tb = bucketKeyOf(target.id);
      if (tb && tb !== target.fixedDate) moveTaskDay(target.id, tb, target.fixedDate);
    } else {
      target.mode = "preferred";
      target.prefStart = src.prefStart;
      target.fixedStart = null;
      target.fixedEnd = null;
      target.fixedDate = null;
      target.repeat = "none";
      target.repeatDays = [];
      target.duration = src.duration;
      target.planStart = targetDate + "T" + (src.prefStart || "09:00");
      var pb = bucketKeyOf(target.id);
      if (pb && pb !== targetDate) moveTaskDay(target.id, pb, targetDate);
    }
    target.rulePaused = false;

    /* 原任务取消固定/偏好约束，回到自由安排（不删除任务本身） */
    src.mode = "free";
    src.prefStart = null;
    src.fixedStart = null;
    src.fixedEnd = null;
    src.fixedDate = null;
    src.repeat = "none";
    src.repeatDays = [];
    src.rulePaused = false;

    save();
    replanRemaining(state.date);   /* 替换后立即重排 */
    closeReplace();
    renderRules();
    render();
    setHint("settingsHint", "已由「" + target.title + "」接管原时段，「" + src.title + "」已取消时间约束。", "ok");
    toast("已替换：" + target.title + " 接管该时间", "ok");
  }

  /* "新建时间规则"：切到新建页并聚焦固定时间模式 */
  function gotoNewRule() {
    $("newMode").value = "fixed";
    $("newHint").dataset.touched = "";
    switchView("new");
  }

  /* ---------------- 计时 ---------------- */
  function currentElapsed(task) {
    if (!task) return 0;
    if (task.status === "doing" && task.startedAt) {
      return task.actual + (Date.now() - task.startedAt) / 1000;
    }
    return task.actual;
  }

  function ensureTick() {
    var task = state.runId ? findTask(state.runId) : null;
    var need = task && task.status === "doing";
    if (need && !tickTimer) {
      tickTimer = setInterval(function () { tick(); }, 1000);
    } else if (!need && tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
  }

  /* ================= Stage 7：后台计时与离开确认（D-08） ================= */

  /* 当前正在执行的任务（仅 status==='doing' 才有离开检测） */
  function runningTask() {
    var t = state.data && state.data.activeId ? findTask(state.data.activeId) : null;
    if (t && t.status === "doing") return t;
    var r = state.runId ? findTask(state.runId) : null;
    return (r && r.status === "doing") ? r : null;
  }

  /* 任务剩余分钟数（目标 - 已计实际）；不小于 0 */
  function taskRemainingMinutes(task) {
    if (!task) return 0;
    var target = Number(task.duration) || 0;
    var done = currentElapsed(task) / 60;
    return Math.max(0, Math.round(target - done));
  }

  /* 页面隐藏/进入后台：记录 lastVisibleAt（仅在 doing 且有 startedAt 时记录离开起点） */
  function onHidden() {
    var t = runningTask();
    if (!t) return;
    var now = Date.now();
    t.lastVisibleAt = now;
    if (t.status === "doing" && t.startedAt) {
      /* 已有未确认的 pendingGapStart：保留，不静默覆盖（避免丢失正在确认的离开区间） */
      if (!t.pendingGapStart) {
        /* 开始新的离开区间：同时清理旧的 end / 缓存秒数，避免残留旧值 */
        t.pendingGapStart = now;
        t.pendingGapEnd = null;
        t.pendingGapSeconds = 0;
      }
    }
    save();
  }

  /* 页面重新可见/重新打开：计算离开时长，按阈值决定是否弹窗 */
  function onVisible() {
    var t = runningTask();
    if (!t) { state.leaveFlow = null; return; }
    var now = Date.now();

    /* 已存在未确认的离开区间：用当前时间更新 pendingGapEnd，再交由 ensurePendingGap 重算 */
    if (t.pendingGapStart) {
      t.pendingGapEnd = now;
      ensurePendingGap(t, now);
      return;
    }

    /* 用 lastVisibleAt 作为离开起点；缺失则不视为离开 */
    var start = Number(t.lastVisibleAt) || state.lastActivityAt;
    if (!start || now <= start) { t.lastVisibleAt = now; save(); return; }

    var awaySec = secondsBetween(start, now);
    var threshold = leaveThresholdMinutes() * 60;

    if (awaySec <= threshold) {
      /* 未超过阈值：直接继续计时，不弹窗 */
      t.lastVisibleAt = now;
      save();
      return;
    }

    /* 超过阈值：创建 pendingGap 并弹窗确认 */
    t.pendingGapStart = start;
    t.pendingGapEnd = now;
    t.pendingGapSeconds = awaySec;
    ensurePendingGap(t, now);
  }

  /* 依据 pendingGapStart/End 规范化离开区间并弹出确认框（防重复、防重复扣除） */
  function ensurePendingGap(t, now) {
    if (!t || !t.pendingGapStart) return;
    var start = Number(t.pendingGapStart);
    /* end 优先取已记录的 pendingGapEnd；缺失（如异常关闭）时用传入 now 补齐 */
    var end = Number(t.pendingGapEnd) || now || Date.now();
    if (!isFinite(start) || !isFinite(end) || end <= start) {
      /* 异常区间（含 end<=start）：安全清空，避免负数或显示旧值 */
      clearPendingGap(t);
      save();
      return;
    }
    /* 时长必须由 start/end 现算，绝不直接信任缓存 pendingGapSeconds */
    var gapSec = secondsBetween(start, end);
    if (gapSec <= 0) { clearPendingGap(t); save(); return; }   /* start/end 异常等价时的兜底 */
    t.pendingGapSeconds = gapSec;    /* 缓存与时间戳保持一致（每次 start/end 变化后重算） */

    var threshold = leaveThresholdMinutes() * 60;

    /* 未超过阈值（如短时间刷新）：不弹窗，清掉离开探针，直接把起点推进到当前 */
    if (gapSec <= threshold) {
      clearPendingGap(t);
      t.lastVisibleAt = now || Date.now();
      save();
      return;
    }

    if (state.leaveFlow && state.leaveFlow.taskId === t.id) return;   /* 已在确认中，不重复 */

    /* 弹窗与后续结算共用同一份 start/end/gapSec */
    state.leaveFlow = { taskId: t.id, start: start, end: end, seconds: gapSec };
    openLeaveModal(t, start, end, gapSec);
  }

  /* 清空 pendingGap（确认后必须调用，避免重复扣除） */
  function clearPendingGap(t) {
    if (!t) return;
    t.pendingGapStart = null;
    t.pendingGapEnd = null;
    t.pendingGapSeconds = 0;
  }

  /* 记录一次离开中断（counted 标记是否计入实际用时） */
  function recordLeaveInterrupt(t, counted, start, end, note) {
    if (!t || !start || !end || end <= start) return;
    t.interrupts = Array.isArray(t.interrupts) ? t.interrupts : [];
    t.interrupts.push({
      start: start,
      end: end,
      counted: !!counted,
      reason: note || (counted ? "离开（计入）" : "离开（不计入）")
    });
  }

  /* 打开离开确认弹窗：标题与区间必须共用同一份 start/end/gapSec */
  function openLeaveModal(t, start, end, gapSec) {
    if (!t) return;
    var sec = safeSeconds(gapSec);
    var durText = fmtLeaveSpan(sec);
    var titleEl = $("leaveModalTitle");
    if (titleEl) titleEl.textContent = "你离开了 " + durText + "，这段时间算入「" + t.title + "」吗？";
    var rangeEl = $("leaveRange");
    if (rangeEl) {
      /* 同一天：10月4日 22:08 – 22:24（16 分钟）；跨天：10月4日 22:08 – 10月5日 08:00（9 小时 52 分钟） */
      var longGap = sec > 12 * 3600;                       /* 超 12 小时：两端都显示完整日期 */
      var endWithDate = !sameDay(start, end) || longGap;
      rangeEl.textContent = fmtDateTime(start, true) + " – " + fmtDateTime(end, endWithDate) + "（" + durText + "）";
    }
    var partEl = $("leavePartMinutes");
    if (partEl) {
      var totalMin = Math.max(1, Math.round(sec / 60));
      partEl.max = String(totalMin);
      partEl.value = String(Math.min(10, totalMin));
    }
    setHint("leaveHint", "");
    showModal($("leaveModal"));
  }

  /* 统一结算基础：离开前真实工作时长（秒） + 返回后到确认时的真实时长（秒） */
  function leaveBase(t, gapStart, gapEnd) {
    var now = Date.now();
    var workedBefore = safeSeconds(t.actual);
    if (t.startedAt && gapStart > t.startedAt) workedBefore += secondsBetween(t.startedAt, gapStart);
    var sinceReturn = secondsBetween(gapEnd, now);   /* 返回后真实继续的时间 */
    return { now: now, workedBefore: workedBefore, sinceReturn: sinceReturn };
  }

  /* 选择一：全部计入 */
  function leaveCountAll() {
    var f = state.leaveFlow;
    var t = f ? findTask(f.taskId) : null;
    if (!t || !f) { closeLeaveFlow(); return; }
    /* 结算口径与弹窗完全一致：优先复用 leaveFlow 中记录的 start/end/gapSec */
    var gapStart = Number(f.start != null ? f.start : t.pendingGapStart);
    var gapEnd = Number(f.end != null ? f.end : t.pendingGapEnd);
    var gapSec = safeSeconds(f.seconds != null ? f.seconds : secondsBetween(gapStart, gapEnd));
    if (!gapStart || !gapEnd || gapEnd <= gapStart || gapSec <= 0) { clearPendingGap(t); closeLeaveFlow(); save(); return; }
    var base = leaveBase(t, gapStart, gapEnd);
    t.actual = safeSeconds(base.workedBefore + gapSec + base.sinceReturn);   /* 离开区间计入实际用时 */
    t.interruptedAt = null;                          /* 已回来继续 */
    recordLeaveInterrupt(t, true, gapStart, gapEnd, "离开 " + fmtLeaveSpan(gapSec) + "（计入）");
    clearPendingGap(t);
    t.lastVisibleAt = base.now;
    if (t.status === "doing") t.startedAt = base.now;     /* 继续后续计时 */
    save();
    closeLeaveFlow();
    toast("已计入 " + fmtLeaveSpan(gapSec) + "，剩余 " + taskRemainingMinutes(t) + " 分钟", "ok");
    render();
  }

  /* 选择二：全部不计入 */
  function leaveCountNone() {
    var f = state.leaveFlow;
    var t = f ? findTask(f.taskId) : null;
    if (!t || !f) { closeLeaveFlow(); return; }
    var start = Number(f.start != null ? f.start : t.pendingGapStart);
    var end = Number(f.end != null ? f.end : t.pendingGapEnd);
    var gapSec = safeSeconds(f.seconds != null ? f.seconds : secondsBetween(start, end));
    if (!start || !end || end <= start || gapSec <= 0) { clearPendingGap(t); closeLeaveFlow(); save(); return; }
    var base = leaveBase(t, start, end);
    t.actual = safeSeconds(base.workedBefore + base.sinceReturn);   /* 不加离开区间 */
    recordLeaveInterrupt(t, false, start, end, "离开 " + fmtLeaveSpan(gapSec) + "（不计入）");
    clearPendingGap(t);
    t.lastVisibleAt = base.now;
    /* 用户已回来并继续：从当前时间重新计时 */
    if (t.status === "doing") t.startedAt = base.now;
    t.interruptedAt = null;
    save();
    closeLeaveFlow();
    replanRemaining(dayKeyOf(t));                    /* 重新安排后续任务 */
    save();
    toast("已忽略离开时间，剩余 " + taskRemainingMinutes(t) + " 分钟", "ok");
    render();
  }

  /* 选择三：只计入一部分（0..离开分钟数） */
  function leaveCountPart() {
    var f = state.leaveFlow;
    var t = f ? findTask(f.taskId) : null;
    if (!t || !f) { closeLeaveFlow(); return; }
    var start = Number(f.start != null ? f.start : t.pendingGapStart);
    var end = Number(f.end != null ? f.end : t.pendingGapEnd);
    var gapSec = safeSeconds(f.seconds != null ? f.seconds : secondsBetween(start, end));
    if (!start || !end || end <= start || gapSec <= 0) { clearPendingGap(t); closeLeaveFlow(); save(); return; }
    var totalMin = gapSec / 60;
    var partMin = Number($("leavePartMinutes").value);
    if (!isFinite(partMin) || partMin < 0) {
      setHint("leaveHint", "请输入 0 ~ " + Math.round(totalMin) + " 之间的分钟数。", "error");
      toast("部分计入数值不合法", "error");
      return;
    }
    if (partMin > totalMin + 0.01) {
      setHint("leaveHint", "部分计入不能超过离开时长 " + Math.round(totalMin) + " 分钟。", "error");
      toast("超过离开时长", "error");
      return;
    }
    var countedSec = Math.round(partMin * 60);
    var base = leaveBase(t, start, end);
    t.actual = safeSeconds(base.workedBefore + countedSec + base.sinceReturn);   /* 只增加指定分钟数 */
    recordLeaveInterrupt(t, true, start, end,
      "离开部分计入 " + Math.round(partMin) + " 分钟 / 未计入 " + Math.round(totalMin - partMin) + " 分钟");
    clearPendingGap(t);
    t.lastVisibleAt = base.now;
    if (t.status === "doing") t.startedAt = base.now;
    t.interruptedAt = null;
    save();
    closeLeaveFlow();
    toast("已计入 " + Math.round(partMin) + " 分钟，未计入 " + Math.round(totalMin - partMin) + " 分钟", "ok");
    render();
  }

  /* 选择四：从离开时暂停 */
  function leavePauseFromAway() {
    var f = state.leaveFlow;
    var t = f ? findTask(f.taskId) : null;
    if (!t || !f) { closeLeaveFlow(); return; }
    var start = Number(f.start != null ? f.start : t.pendingGapStart);
    var end = Number(f.end != null ? f.end : t.pendingGapEnd) || start;
    if (!start || end <= start) { clearPendingGap(t); closeLeaveFlow(); save(); return; }
    recordLeaveInterrupt(t, false, start, end, "离开后暂停（不计入）");
    /* 保留离开前实际用时：累计已存盘 actual + 本段 doing 计时（startedAt → 离开起点） */
    if (t.startedAt) {
      var ranSec = secondsBetween(t.startedAt, start);
      t.actual = safeSeconds(t.actual + ranSec);
      t.startedAt = null;
    }
    clearPendingGap(t);
    t.status = "paused";
    t.interruptedAt = start;                         /* 中断起点=离开开始时间 */
    t.lastVisibleAt = Date.now();
    if (state.data.activeId === t.id) state.data.activeId = null;
    if (state.runId === t.id) state.runId = t.id;    /* 仍选中该任务便于继续 */
    save();
    closeLeaveFlow();
    replanRemaining(dayKeyOf(t));                    /* 重新安排后续任务 */
    save();
    toast("已从离开时暂停：" + t.title, "");
    render();
  }

  function closeLeaveFlow() {
    state.leaveFlow = null;
    hideModal($("leaveModal"));
  }

  /* 确认后统一清空 pendingGap，避免重复扣除 */
  function dismissLeave() {
    var f = state.leaveFlow;
    if (f) {
      var t = findTask(f.taskId);
      if (t) { clearPendingGap(t); t.lastVisibleAt = Date.now(); }
    }
    save();
    closeLeaveFlow();
    render();
  }

  function tick() {
    var task = state.runId ? findTask(state.runId) : null;
    if (!task || task.status !== "doing") { ensureTick(); return; }
    $("runTimer").textContent = fmtTimer(currentElapsed(task));
    if (task.interruptedAt) {
      var away = (Date.now() - task.interruptedAt) / 60000;
      var th = Number(state.data.settings.leaveThreshold) || 15;
      if (away >= th) {
        $("runStatus").textContent = "已暂停 · 离开 " + Math.round(away) + " 分钟";
      }
    }
  }

  /* ---------------- 渲染入口 ---------------- */
  function render() {
    if (state.view === "today") renderToday();
    else if (state.view === "new") renderNew();
    else if (state.view === "run") renderRun();
    else if (state.view === "review") { renderReview(); renderHistory(); renderHistoryDetail(); }
    else if (state.view === "settings") renderSettings();
    ensureTick();
  }

  /* ---------------- 任务操作 ---------------- */
  function startTask(id) {
    var task = id ? findTask(id) : findTask(state.runId);
    if (!task) { toast("请先选择任务", "error"); return; }
    if (task.status === "done") { toast("任务已完成，无法再次开始", "error"); return; }
    if (task.status === "doing") { toast("任务正在执行中", "error"); return; }

    if (state.data.activeId && state.data.activeId !== task.id) {
      var prev = findTask(state.data.activeId);
      if (prev && prev.status === "doing") {
        prev.status = "paused";
        prev.interruptedAt = Date.now();
        if (prev.startedAt) { prev.actual += (Date.now() - prev.startedAt) / 1000; prev.startedAt = null; }
        toast("已自动暂停「" + prev.title + "」", "");
      }
    }

    if (task.status === "paused" && task.interruptedAt) {
      var gap = Math.round((Date.now() - task.interruptedAt) / 60000);
      if (gap > 0) { task.interrupts.push({ start: task.interruptedAt, end: Date.now(), reason: "暂停 " + gap + " 分钟" }); }
      task.interruptedAt = null;
    }

    task.status = "doing";
    task.startedAt = Date.now();
    task.lastVisibleAt = task.startedAt;
    clearPendingGap(task);
    state.data.activeId = task.id;
    state.runId = task.id;
    save();
    toast("开始执行：" + task.title, "ok");
    render();
  }

  function pauseTask() {
    var task = state.runId ? findTask(state.runId) : null;
    if (!task || task.status !== "doing") { toast("当前没有正在执行的任务", "error"); return; }
    task.actual += (Date.now() - task.startedAt) / 1000;
    task.startedAt = null;
    task.status = "paused";
    task.interruptedAt = Date.now();
    save();
    toast("已暂停，随时可以继续", "");
    render();
  }

  function resumeTask() {
    var task = state.runId ? findTask(state.runId) : null;
    if (!task || task.status !== "paused") { toast("当前没有已暂停的任务", "error"); return; }
    var gap = task.interruptedAt ? Math.round((Date.now() - task.interruptedAt) / 60000) : 0;
    if (gap >= 1 && !task.interrupts.some(function (it) { return !it.end; })) {
      task.interrupts.push({ start: task.interruptedAt, end: Date.now(), reason: "暂停 " + gap + " 分钟" });
    }
    task.interruptedAt = null;
    task.status = "doing";
    task.startedAt = Date.now();
    task.lastVisibleAt = task.startedAt;
    clearPendingGap(task);
    state.data.activeId = task.id;
    save();
    toast("继续执行：" + task.title, "ok");
    render();
  }

  function breakTask() {
    var task = state.runId ? findTask(state.runId) : null;
    if (!task || task.status !== "doing") { toast("仅进行中的任务可记录中断", "error"); return; }
    task.actual += (Date.now() - task.startedAt) / 1000;
    task.startedAt = null;
    task.status = "paused";
    task.interruptedAt = Date.now();
    task.interrupts.push({ start: Date.now(), end: null, reason: "临时中断" });
    save();
    toast("已记录中断，休息一下再继续", "");
    render();
  }

  function completeTask(id) {
    var task = id ? findTask(id) : (state.runId ? findTask(state.runId) : null);
    if (!task) { toast("请先选择任务", "error"); return; }
    if (task.status === "done") { toast("任务已经是完成状态", "error"); return; }

    if (task.status === "doing" && task.startedAt) {
      task.actual += (Date.now() - task.startedAt) / 1000;
      task.startedAt = null;
    }
    task.interrupts.forEach(function (it) { if (!it.end) it.end = Date.now(); });
    task.interruptedAt = null;
    task.status = "done";

    var plan = parseMinutes(task.planStart.slice(11));
    var cap = timelineCapacity();
    if (plan + task.duration > cap) task.delay = plan + task.duration - cap;

    if (state.data.activeId === task.id) state.data.activeId = null;
    save();
    toast("已完成：" + task.title + "（实际 " + fmtShort(task.actual / 60) + "）", "ok");
    render();
  }

  function toggleTask(id) {
    var task = findTask(id);
    if (!task) return;
    if (task.status === "done") {
      task.status = "pending";
      task.actual = 0;
      task.startedAt = null;
      task.interruptedAt = null;
      if (state.data.activeId === task.id) state.data.activeId = null;
      save();
      toast("已恢复为待开始", "");
    } else {
      completeTask(id);
      return;
    }
    render();
  }

  function deleteTask(id) {
    var task = findTask(id);
    if (!task) return;
    if (!window.confirm("确定删除任务「" + task.title + "」吗？")) return;
    removeTask(id);
    if (state.data.activeId === id) state.data.activeId = null;
    if (state.runId === id) state.runId = null;
    save();
    toast("已删除：" + task.title, "");
    render();
  }

  /* ---------------- 编辑任务 ---------------- */
  var editingId = null;

  function renderEditModeUI() {
    var mode = $("editMode").value;
    $("editFreeBox").hidden = mode !== "free";
    $("editPreferredBox").hidden = mode !== "preferred";
    $("editFixedBox").hidden = mode !== "fixed";
    syncRepeatDaysUI("editFixedRepeat", "editFixedRepeatDays");
  }

  function openEdit(id) {
    var t = findTask(id);
    if (!t) { toast("任务不存在", "error"); return; }
    editingId = id;
    $("editTitle").value = t.title;
    $("editMode").value = MODE_TEXT[t.mode] ? t.mode : "free";
    $("editDuration").value = t.duration;
    $("editDate").value = t.mode === "fixed" && t.fixedDate ? t.fixedDate : dayKeyOf(t);
    $("editStart").value = t.planStart.slice(11);
    $("editPrefStart").value = t.prefStart || t.planStart.slice(11);
    $("editFixedStart").value = t.fixedStart || "15:00";
    $("editFixedEnd").value = t.fixedEnd || "17:00";
    $("editFixedRepeat").value = REPEAT_TEXT[t.repeat] ? t.repeat : "none";
    setRepeatDays("editFixedRepeatDays", t.repeatDays || []);
    setHint("editHint", "");
    renderEditModeUI();
    showModal($("editModal"));
  }

  function closeEdit() {
    editingId = null;
    hideModal($("editModal"));
  }

  function saveEdit() {
    var t = editingId ? findTask(editingId) : null;
    if (!t) { toast("任务不存在", "error"); closeEdit(); return; }

    var title = $("editTitle").value.trim();
    var mode = $("editMode").value;
    var duration = Number($("editDuration").value);
    var date = $("editDate").value || dayKeyOf(t);

    if (!title) { setHint("editHint", "任务名称不能为空。", "error"); toast("名称不能为空", "error"); return; }
    if (!duration || duration < 5) { setHint("editHint", "目标时长需为不小于 5 的分钟数。", "error"); toast("目标时长不合法", "error"); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { setHint("editHint", "请选择有效日期。", "error"); toast("日期不合法", "error"); return; }

    var oldBucket = bucketKeyOf(t.id);

    if (mode === "fixed") {
      var form = readFixedForm("edit", date);
      if (form.error) { setHint("editHint", form.error, "error"); toast("固定时间不合法", "error"); return; }
      var conflict = fixedConflict(form.start, form.end, collectTasks(form.date), t.id, form.date);
      if (conflict) {
        setHint("editHint", "无法保存：该固定时段" + conflict + "。已有时段不会被自动覆盖。", "error");
        toast("固定时间冲突，未保存", "error");
        return;
      }
      t.mode = "fixed";
      t.fixedStart = form.start;
      t.fixedEnd = form.end;
      t.fixedDate = form.date;
      t.repeat = form.repeat;
      t.repeatDays = form.repeatDays;
      t.prefStart = null;
      t.planStart = form.date + "T" + form.start;
      date = form.date;
    } else if (mode === "preferred") {
      var pref = $("editPrefStart").value || "09:00";
      t.mode = "preferred";
      t.prefStart = pref;
      t.fixedStart = null;
      t.fixedEnd = null;
      t.fixedDate = null;
      t.repeat = "none";
      t.repeatDays = [];
      t.planStart = date + "T" + pref;
    } else {
      var start = $("editStart").value || "09:00";
      t.mode = "free";
      t.prefStart = null;
      t.fixedStart = null;
      t.fixedEnd = null;
      t.fixedDate = null;
      t.repeat = "none";
      t.repeatDays = [];
      t.planStart = date + "T" + start;
    }
    t.title = title;
    t.duration = duration;
    t.estimated = false;

    /* 日期变化时移动所属分组，确保持久化后仍能正确加载 */
    if (oldBucket && oldBucket !== date) moveTaskDay(t.id, oldBucket, date);

    save();
    replanRemaining(state.date);   /* 编辑固定/偏好时间后立即重排当前日期 */
    save();
    toast("已保存：" + t.title, "ok");
    closeEdit();
    render();
  }

  /* ---------------- 新建任务 ---------------- */
  function baseTask() {
    return {
      id: uid(), title: "", planStart: state.date + "T09:00", duration: 30,
      status: "pending", actual: 0, startedAt: null, interruptedAt: null,
      interrupts: [], delay: 0, mode: "free", prefStart: null,
      fixedStart: null, fixedEnd: null, fixedDate: null, repeat: "none",
      repeatDays: [], rulePaused: false, estimated: false, extStart: null, extDuration: 0,
      notes: [], resumeFrom: "",
      lastVisibleAt: null, pendingGapStart: null, pendingGapEnd: null, pendingGapSeconds: 0
    };
  }

  /* 计算指定日期的空闲起点（用于自由/偏好任务顺延） */
  function nextCursor(dateKey, startTime) {
    var tasks = collectTasks(dateKey);
    var slots = computeSlots(tasks, dateKey).slots;
    var cursor = parseMinutes(startTime);
    slots.forEach(function (s) {
      if (s.end > cursor) cursor = s.end + bufferMinutes();
    });
    return cursor;
  }

  function addTasks() {
    var mode = $("newMode").value;
    var raw = $("bulkInput").value;
    var lines = raw.split("\n").map(function (l) { return l.trim(); }).filter(function (l) { return l.length > 0; });
    if (!lines.length) {
      setHint("newHint", "请至少输入一个任务，每行一个。", "error");
      toast("没有可添加的任务", "error");
      return;
    }

    var targetDate = $("newDate").value || state.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      setHint("newHint", "请选择有效的安排日期。", "error");
      toast("安排日期不合法", "error");
      return;
    }

    /* 固定时间：单个任务 + 冲突校验 */
    if (mode === "fixed") {
      if (lines.length > 1) {
        setHint("newHint", "固定时间模式一次只能添加一个任务，请只保留一行，或改用「自由安排」。", "error");
        toast("固定时间仅支持单个任务", "error");
        return;
      }
      var form = readFixedForm("new", targetDate);
      if (form.error) {
        setHint("newHint", form.error, "error");
        toast("固定时间不合法", "error");
        return;
      }
      var fixedDur = resolveDuration($("defaultDuration").value, lines[0]);
      if (fixedDur.error) {
        setHint("newHint", fixedDur.error, "error");
        toast("目标时长不合法", "error");
        return;
      }
      var bucket = getDay(form.date);
      var conflict = fixedConflict(form.start, form.end, collectTasks(form.date), null, form.date);
      if (conflict) {
        var conflictMsg = "无法添加：固定时段已被占用，" + conflict +
          "。已有时段不会被自动覆盖；若这是内置示例数据中的同名任务，请先在「今日」删除它或改用其他时段。";
        setHint("newHint", conflictMsg, "error");
        toast("固定时段已被占用：" + conflict, "error");
        alertVisible(conflictMsg);
        return;
      }
      var ft = baseTask();
      ft.title = lines[0];
      ft.mode = "fixed";
      ft.duration = fixedDur.minutes;
      ft.estimated = fixedDur.estimated;
      ft.fixedStart = form.start;
      ft.fixedEnd = form.end;
      ft.fixedDate = form.date;
      ft.repeat = form.repeat;
      ft.repeatDays = form.repeatDays;
      ft.planStart = form.date + "T" + form.start;
      bucket.push(ft);
      save();
      $("bulkInput").value = "";
      $("newHint").dataset.touched = "";
      var extra = Math.max(0, ft.duration - (parseMinutes(form.end) - parseMinutes(form.start)));
      setHint("newHint", "已添加固定任务「" + ft.title + "」：" + form.date + " " + form.start + "–" + form.end +
        (fixedDur.estimated ? "（目标时长自动估算为 " + ft.duration + " 分钟）" : "") +
        (extra > 0 ? "，超出固定时段的 " + extra + " 分钟将自动安排到其他空闲时间。" : "。"), "ok");
      toast("已添加固定任务：" + ft.title, "ok");
      /* 自动跳到该固定任务所在日期并切换到「今日」，便于立刻看到结果 */
      state.date = form.date;
      switchView("today");
      return;
    }

    /* 自由 / 偏好：可批量；每行时长按行对应，缺省用统一时长或自动估时 */
    var startTime = mode === "preferred" ? ($("newPrefStart").value || "09:00") : ($("defaultStart").value || "09:00");
    var defRaw = $("defaultDuration").value.trim();
    var defResolved = resolveDuration(defRaw, "");
    if (defResolved.error) {
      setHint("newHint", defResolved.error, "error");
      toast("目标时长不合法", "error");
      return;
    }
    var durs = splitDurations($("bulkDurations").value);

    /* 先逐行解析并校验，避免写入一半再报错 */
    var planned = [];
    for (var i = 0; i < lines.length; i++) {
      if (durs[i] !== undefined) {
        var r = resolveDuration(durs[i], lines[i]);
        if (r.error) {
          setHint("newHint", "第 " + (i + 1) + " 行：" + r.error, "error");
          toast("目标时长不合法", "error");
          return;
        }
        planned.push(r);
      } else if (defRaw !== "") {
        planned.push({ minutes: defResolved.minutes, estimated: false });
      } else {
        planned.push(resolveDuration("", lines[i]));
      }
    }

    var tasks = getDay(targetDate);
    var cursor = nextCursor(targetDate, startTime);
    var created = [];
    var estimatedCount = 0;
    lines.forEach(function (title, idx) {
      var p = planned[idx];
      if (p.estimated) estimatedCount++;
      var t = baseTask();
      t.title = title;
      t.mode = mode;
      t.duration = p.minutes;
      t.estimated = p.estimated;
      if (mode === "preferred") {
        t.prefStart = startTime;
        t.planStart = targetDate + "T" + startTime;
      } else {
        t.planStart = targetDate + "T" + minutesToHHMM(cursor);
      }
      tasks.push(t);
      created.push(t);
      cursor += p.minutes + bufferMinutes();
    });

    save();
    replanRemaining(targetDate);   /* 新增任务后立即重排，时间线与实际一致 */
    save();
    $("bulkInput").value = "";
    $("bulkDurations").value = "";
    $("newHint").dataset.touched = "";
    setHint("newHint", "已添加 " + created.length + " 个任务到 " + targetDate +
      (mode === "preferred" ? "，偏好时间 " + startTime : "，首个开始于 " + created[0].planStart.slice(11)) +
      (estimatedCount > 0 ? "；其中 " + estimatedCount + " 个为自动估算时长" : "") + "。", "ok");
    toast("已添加 " + created.length + " 个任务", "ok");
    state.date = targetDate;
    switchView("today");
  }

  /* ---------------- 设置操作 ---------------- */
  function saveSettings() {
    var sleepStart = $("setSleepStart").value;
    var sleepEnd = $("setSleepEnd").value;
    var mealDuration = Number($("setMealDuration").value);
    var breakBuffer = Number($("setBreakBuffer").value);
    var leaveThreshold = Number($("setLeaveThreshold").value);

    if (!sleepStart || !sleepEnd) {
      setHint("settingsHint", "请填写完整的入睡与起床时间。", "error");
      toast("睡眠时间不完整", "error");
      return;
    }
    if (sleepStart === sleepEnd) {
      setHint("settingsHint", "入睡与起床时间不能相同。", "error");
      toast("睡眠时间不合法", "error");
      return;
    }
    if (!mealDuration || mealDuration < 10 || mealDuration > 180) {
      setHint("settingsHint", "每餐时长应在 10 ~ 180 分钟之间。", "error");
      toast("每餐时长不合法", "error");
      return;
    }
    if (isNaN(breakBuffer) || breakBuffer < 0 || breakBuffer > 120) {
      setHint("settingsHint", "休息缓冲应在 0 ~ 120 分钟之间。", "error");
      toast("休息缓冲不合法", "error");
      return;
    }
    if (!leaveThreshold || leaveThreshold < 1 || leaveThreshold > 60) {
      setHint("settingsHint", "离开确认阈值应在 1 ~ 60 分钟之间。", "error");
      toast("离开阈值不合法", "error");
      return;
    }

    state.data.settings = Object.assign({}, state.data.settings, {
      sleepStart: sleepStart,
      sleepEnd: sleepEnd,
      breakfast: $("setBreakfast").value || "08:00",
      lunch: $("setLunch").value || "12:00",
      dinner: $("setDinner").value || "18:30",
      mealDuration: mealDuration,
      breakBuffer: breakBuffer,
      leaveThreshold: leaveThreshold
    });
    collectFixedBlocks();
    save();
    replanRemaining(state.date);   /* 设置变化（睡眠/缓冲/固定占用）后立即重排 */
    save();
    setHint("settingsHint", "设置已保存于 " + fmtClock(Date.now()) + "。", "ok");
    toast("设置已保存", "ok");
    render();
  }

  function resetSettings() {
    if (!window.confirm("恢复默认设置？（不会删除任务数据）")) return;
    state.data.settings = clone(DEFAULT_SETTINGS);
    save();
    setHint("settingsHint", "已恢复默认设置。", "ok");
    toast("已恢复默认设置", "ok");
    render();
  }

  function clearAll() {
    if (!window.confirm("确定清空全部数据？此操作不可撤销。")) return;
    state.data = { version: 2, settings: clone(DEFAULT_SETTINGS), days: {}, activeId: null, updatedAt: Date.now() };
    state.runId = null;
    save();
    setHint("settingsHint", "已清空全部数据。", "ok");
    toast("已清空全部数据", "");
    render();
  }

  function loadDemo() {
    if (!window.confirm("载入示例数据？将覆盖当前全部数据。")) return;
    state.data = buildDemoData();
    state.runId = null;
    state.date = todayKey();
    save();
    setHint("settingsHint", "已载入示例数据。", "ok");
    toast("示例数据已就绪", "ok");
    render();
  }

  /* ---------------- 数据导出 / 导入（本地 JSON，不经云端） ---------------- */

  /* 导出当前 localStorage 数据为 JSON 文件（含元信息，便于人工核对） */
  function exportData() {
    var payload = {
      app: "BlockFlow",
      storageKey: STORAGE_KEY,
      exportedAt: Date.now(),
      data: state.data
    };
    var text = JSON.stringify(payload, null, 2);
    var d = new Date();

    var name = "blockflow-backup-" + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) +
      "-" + pad(d.getHours()) + pad(d.getMinutes()) + ".json";
    try {
      var blob = new Blob([text], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) { /* 忽略 */ } }, 1000);
      setHint("dataHint", "已导出：" + name, "ok");
      toast("数据已导出", "ok");
    } catch (e) {
      var reason = e && e.message ? e.message : String(e);
      setHint("dataHint", "导出失败：" + reason, "error");
      toast("导出失败：" + reason, "error");
      throw e;
    }
  }

  /* 触发文件选择（真正的解析在 importData 中） */
  function pickImportFile() {
    var input = $("importFile");
    if (!input) return;
    input.value = "";
    input.click();
  }

  function looksLikeData(obj) {
    return obj && typeof obj === "object" &&
      (obj.days !== undefined || obj.settings !== undefined || obj.version !== undefined);
  }

  /* 校验并按需归一化导入内容；任何不合格都抛出带原因的异常（由调用方显示） */
  function importData(text) {
    var parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      throw new Error("不是合法的 JSON 文件");
    }
    var obj = parsed;
    if (parsed && typeof parsed === "object" && parsed.app === "BlockFlow" && parsed.data && typeof parsed.data === "object") {
      obj = parsed.data;   /* 兼容本应用导出的带元信息格式 */
    }
    if (!looksLikeData(obj)) {
      throw new Error("格式不匹配：缺少 settings / days 等字段，非 BlockFlow 数据");
    }
    if (obj.days !== undefined && (obj.days === null || typeof obj.days !== "object" || Array.isArray(obj.days))) {
      throw new Error("格式错误：days 必须是对象");
    }
    if (obj.settings !== undefined && (obj.settings === null || typeof obj.settings !== "object" || Array.isArray(obj.settings))) {
      throw new Error("格式错误：settings 必须是对象");
    }
    return normalize(obj);
  }

  /* 导入入口：校验通过才覆盖当前数据；失败保留原数据并显示原因 */
  function importDataFromFile(file) {
    if (!file) return;
    var hint = $("dataHint");
    try {
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var incoming = importData(String(reader.result));
          if (!window.confirm("导入将覆盖当前全部数据（当前 " +
            Object.keys(state.data.days || {}).length + " 天记录）。确定继续？")) {
            setHint("dataHint", "已取消导入，现有数据未改动。", "ok");
            return;
          }
          try { localStorage.setItem(STORAGE_KEY + ".bak", JSON.stringify(state.data)); } catch (e) { /* 备份失败不阻断 */ }
          state.data = incoming;
          state.runId = null;
          state.date = todayKey();
          save();
          setHint("dataHint", "导入成功，已用备份替换当前数据。", "ok");
          toast("数据已导入", "ok");
          initViewAfterImport();
        } catch (err) {
          var reason = err && err.message ? err.message : String(err);
          setHint("dataHint", "导入失败：" + reason + "（现有数据未改动）", "error");
          toast("导入失败：" + reason, "error");
          scrollIntoViewSafe($("dataHint"));
        }
      };
      reader.onerror = function () {
        setHint("dataHint", "导入失败：无法读取文件", "error");
        toast("导入失败：无法读取文件", "error");
        scrollIntoViewSafe($("dataHint"));
      };
      reader.readAsText(file);
    } catch (e) {
      setHint("dataHint", "导入失败：" + (e && e.message ? e.message : String(e)), "error");
      toast("导入失败", "error");
      scrollIntoViewSafe($("dataHint"));
    }
  }

  /* 导入成功后刷新页面状态：切到今日并重绘（当前视图即为设置页，无需重绑事件） */
  function initViewAfterImport() {
    var active = state.data.activeId ? findTask(state.data.activeId) : null;
    if (active) { state.runId = active.id; state.date = dayKeyOf(active); }
    switchView("today");
    render();
  }

  /* ---------------- 绑定事件 ---------------- */
  function bind() {
    document.querySelectorAll(".tab").forEach(function (t) {
      t.addEventListener("click", function () { switchView(t.dataset.view); });
    });

    $("prevDay").addEventListener("click", function () { setDate(shiftKey(state.date, -1)); });
    $("nextDay").addEventListener("click", function () { setDate(shiftKey(state.date, 1)); });
    $("todayPill").addEventListener("click", function () { setDate(todayKey()); });

    $("taskList").addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-act]");
      if (!btn) return;
      var id = btn.dataset.id;
      var act = btn.dataset.act;
      if (act === "toggle") toggleTask(id);
      else if (act === "run") {
        state.runId = id;
        var task = findTask(id);
        if (task) state.date = dayKeyOf(task);
        switchView("run");
      } else if (act === "edit") openEdit(id);
      else if (act === "delete") deleteTask(id);
    });

    $("shortagePanel").addEventListener("click", guard(function (e) {
      var btn = e.target.closest("button[data-shortage]");
      if (!btn) return;
      var idx = Number(btn.dataset.shortage);
      if (!isFinite(idx)) return;
      applyShortageOption(idx);
    }, "应用时间不足方案"));

    $("addTasksBtn").addEventListener("click", guard(addTasks, "添加任务"));
    $("newMode").addEventListener("change", guard(function () {
      $("newHint").dataset.touched = "";
      renderNewModeUI();
    }, "切换安排方式"));
    $("newDateToday").addEventListener("click", guard(function () {
      $("newDate").value = todayKey();
      $("newHint").dataset.touched = "";
      renderNewModeUI();
    }, "选择今天"));
    $("newDateTomorrow").addEventListener("click", guard(function () {
      $("newDate").value = shiftKey(todayKey(), 1);
      $("newHint").dataset.touched = "";
      renderNewModeUI();
    }, "选择明天"));
    $("newDate").addEventListener("change", guard(function () {
      $("newHint").dataset.touched = "";
      renderNewModeUI();
    }, "修改日期"));
    $("newFixedRepeat").addEventListener("change", function () {
      syncRepeatDaysUI("newFixedRepeat", "newFixedRepeatDays");
    });
    $("fillDemoBtn").addEventListener("click", guard(function () {
      $("newMode").value = "fixed";
      $("bulkInput").value = "英语";
      $("defaultDuration").value = "180";
      $("newFixedStart").value = "15:00";
      $("newFixedEnd").value = "17:00";
      $("newDate").value = state.date;
      $("newFixedRepeat").value = "none";
      $("newHint").dataset.touched = "";
      renderNewModeUI();
      setHint("newHint", "已填充：固定 15:00–17:00、目标 3 小时。可直接点击「添加到当天」。", "ok");
    }, "填充示例"));
    /* 用户一改动输入就清除旧的错误提示，避免过期报错误导 */
    function clearNewError() {
      var hint = $("newHint");
      var hadError = hint.className.indexOf("error") >= 0;
      hint.dataset.touched = "";
      if (hadError) renderNewModeUI();
    }
    $("bulkInput").addEventListener("input", clearNewError);
    $("defaultDuration").addEventListener("input", clearNewError);
    $("bulkDurations").addEventListener("input", clearNewError);

    /* 编辑弹窗 */
    $("editMode").addEventListener("change", renderEditModeUI);
    $("editFixedRepeat").addEventListener("change", function () {
      syncRepeatDaysUI("editFixedRepeat", "editFixedRepeatDays");
    });
    $("editSaveBtn").addEventListener("click", guard(saveEdit, "保存修改"));
    $("editCancelBtn").addEventListener("click", closeEdit);
    $("editModal").addEventListener("click", function (e) {
      if (e.target.dataset.act === "cancel") closeEdit();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !$("leaveModal").hidden) { dismissLeave(); return; }
      if (e.key === "Escape" && !$("editModal").hidden) { closeEdit(); return; }
      if (e.key === "Escape" && !$("replaceModal").hidden) { closeReplace(); return; }
      if (!$("leaveModal").hidden) trapFocus(e, $("leaveModal"));
      else if (!$("editModal").hidden) trapFocus(e, $("editModal"));
      else if (!$("replaceModal").hidden) trapFocus(e, $("replaceModal"));
    });

    /* 离开确认弹窗（Stage 7） */
    $("leaveAllBtn").addEventListener("click", guard(leaveCountAll, "全部计入"));
    $("leaveNoneBtn").addEventListener("click", guard(leaveCountNone, "全部不计入"));
    $("leavePartBtn").addEventListener("click", guard(leaveCountPart, "部分计入"));
    $("leavePauseBtn").addEventListener("click", guard(leavePauseFromAway, "从离开时暂停"));
    $("leaveModal").addEventListener("click", function (e) {
      if (e.target.dataset.act === "cancel") dismissLeave();
    });

    /* 后台计时与离开检测（Stage 7，D-08）：用时间戳恢复，不依赖 setInterval */
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) onHidden();
      else onVisible();
    });
    window.addEventListener("pagehide", onHidden);
    window.addEventListener("beforeunload", onHidden);
    window.addEventListener("pageshow", function () { onVisible(); });

    $("runTaskSelect").addEventListener("change", function () {
      state.runId = this.value || null;
      render();
    });
    $("btnStart").addEventListener("click", function () { startTask(null); });
    $("btnPause").addEventListener("click", pauseTask);
    $("btnResume").addEventListener("click", resumeTask);
    $("btnBreak").addEventListener("click", breakTask);
    $("btnComplete").addEventListener("click", function () { completeTask(null); });
    $("runNoteAddBtn").addEventListener("click", guard(saveRunNote, "保存备注"));

    /* 复盘筛选 */
    $("reviewFilters").addEventListener("click", guard(function (e) {
      var btn = e.target.closest("button[data-filter]");
      if (!btn) return;
      reviewFilter = btn.dataset.filter;
      document.querySelectorAll("#reviewFilters button[data-filter]").forEach(function (b) {
        var on = b.dataset.filter === reviewFilter;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });
      renderReview();
    }, "切换复盘筛选"));

    /* 历史记录：点击某天查看详情 */
    $("historyList").addEventListener("click", guard(function (e) {
      var btn = e.target.closest("button[data-date]");
      if (!btn) return;
      setDate(btn.dataset.date);
    }, "查看历史日期"));

    $("saveSettingsBtn").addEventListener("click", saveSettings);
    $("resetSettingsBtn").addEventListener("click", resetSettings);
    $("clearAllBtn").addEventListener("click", clearAll);
    $("loadDemoBtn").addEventListener("click", loadDemo);
    $("exportDataBtn").addEventListener("click", guard(exportData, "导出数据"));
    $("importDataBtn").addEventListener("click", guard(pickImportFile, "导入数据"));
    $("importFile").addEventListener("change", function (e) {
      var file = e.target.files && e.target.files[0];
      if (file) importDataFromFile(file);
    });

    /* 固定占用（上课 / 通勤等） */
    $("addFixedBlockBtn").addEventListener("click", guard(function () {
      state.data.settings.fixedBlocks = state.data.settings.fixedBlocks || [];
      state.data.settings.fixedBlocks.push({ id: uid(), label: "固定占用", start: "08:00", end: "09:00", days: [] });
      save();
      renderFixedBlocks();
      setHint("settingsHint", "已添加固定占用，请填写名称与时间。", "ok");
    }, "添加固定占用"));
    $("fixedBlocksList").addEventListener("change", guard(collectFixedBlocks, "保存固定占用"));
    $("fixedBlocksList").addEventListener("input", guard(collectFixedBlocks, "保存固定占用"));
    $("fixedBlocksList").addEventListener("click", guard(function (e) {
      var btn = e.target.closest('button[data-act="remove"]');
      if (!btn) return;
      var item = btn.closest(".fixed-block");
      var id = item ? item.dataset.id : null;
      if (!id) return;
      state.data.settings.fixedBlocks = (state.data.settings.fixedBlocks || []).filter(function (b) { return b.id !== id; });
      save();
      renderFixedBlocks();
      setHint("settingsHint", "已删除固定占用。", "ok");
    }, "删除固定占用"));

    /* 时间规则表：编辑 / 替换 / 暂停 / 恢复 / 删除 */
    $("rulesList").addEventListener("click", guard(function (e) {
      var btn = e.target.closest("button[data-act]");
      if (!btn) return;
      var item = btn.closest(".rule-item");
      var id = item ? item.dataset.id : null;
      if (!id) return;
      var act = btn.dataset.act;
      if (act === "edit") openEdit(id);
      else if (act === "replace") openReplace(id);
      else if (act === "pause" || act === "resume") toggleRulePause(id);
      else if (act === "delete") deleteRule(id);
    }, "规则表操作"));
    $("newRuleBtn").addEventListener("click", guard(gotoNewRule, "新建时间规则"));

    /* 替换任务弹窗 */
    $("replaceConfirmBtn").addEventListener("click", guard(applyReplace, "替换任务"));
    $("replaceCancelBtn").addEventListener("click", closeReplace);
    $("replaceModal").addEventListener("click", function (e) {
      if (e.target.dataset.act === "cancel") closeReplace();
    });

    window.addEventListener("storage", function (e) {
      if (e.key === STORAGE_KEY) {
        load();
        render();
      }
    });

    /* 全局错误兜底：任何未捕获错误/异步异常都可见，避免静默失败 */
    window.addEventListener("error", function (e) {
      var msg = (e && e.message) ? e.message : "未知错误";
      try { toast("发生错误：" + msg, "error"); } catch (err) { /* 提示失败时不再抛出 */ }
    });
    window.addEventListener("unhandledrejection", function () {
      try { toast("发生未处理的异步错误", "error"); } catch (err) { /* ignore */ }
    });
  }

  /* ---------------- Stage 8：PWA 基础（Service Worker + 安装到桌面） ---------------- */

  /* 注册 Service Worker：仅在 http/https 下注册；file:// 或环境不支持时安全跳过，不抛错、不白屏 */
  function registerServiceWorker() {
    try {
      if (!("serviceWorker" in navigator)) return;
      var proto = location.protocol;
      if (proto !== "http:" && proto !== "https:") return;   /* file:// 下不注册 */
      navigator.serviceWorker.register("service-worker.js").catch(function () {
        /* 注册失败（如非安全上下文）不阻塞应用，也不报红 */
      });
    } catch (e) { /* 忽略：PWA 为可选增强 */ }
  }

  /* 安装到桌面：捕获 beforeinstallprompt；不支持或 file:// 下按钮保持隐藏 */
  var deferredInstall = null;
  function setupInstallPrompt() {
    try {
      var panel = $("pwaPanel"), btn = $("installAppBtn"), hint = $("installHint");
      if (!btn) return;
      /* 仅在 http/https 且支持安装能力时展示该面板 */
      var httpish = location.protocol === "http:" || location.protocol === "https:";
      if (!httpish || !("serviceWorker" in navigator)) {
        if (panel) panel.hidden = true;
        return;
      }

      window.addEventListener("beforeinstallprompt", function (e) {
        e.preventDefault();
        deferredInstall = e;
        btn.hidden = false;
        if (hint) hint.textContent = "可安装到桌面，离线也能打开。";
      });

      window.addEventListener("appinstalled", function () {
        deferredInstall = null;
        btn.hidden = true;
        if (hint) hint.textContent = "已安装到桌面。";
        toast("已安装到桌面", "ok");
      });

      btn.addEventListener("click", function () {
        if (!deferredInstall) {
          if (hint) hint.textContent = "当前浏览器未提供自动安装入口，可用浏览器菜单中的「安装 / 添加到主屏幕」。";
          return;
        }
        var p = deferredInstall;
        deferredInstall = null;
        btn.hidden = true;
        try {
          p.prompt();
          if (p.userChoice && p.userChoice.then) {
            p.userChoice.then(function (res) {
              if (res && res.outcome === "dismissed" && hint) hint.textContent = "已取消安装。";
            });
          }
        } catch (e) { /* 忽略提示异常 */ }
      });
    } catch (e) { /* 忽略：不影响主流程 */ }
  }

  /* ---------------- 启动 ---------------- */
  var inited = false;
  function init() {
    if (inited) return;
    inited = true;
    load();
    var active = state.data.activeId ? findTask(state.data.activeId) : null;
    if (active) { state.runId = active.id; state.date = dayKeyOf(active); }
    bind();
    switchView("today");
    /* Stage 7：重新打开页面后恢复未确认的离开区间（localStorage 中的 pendingGap） */
    var resumed = state.data.activeId ? findTask(state.data.activeId) : null;
    if (!resumed || !resumed.pendingGapStart) {
      /* activeId 缺失或非待确认时，扫描全部任务寻找待确认项（异常关闭场景） */
      resumed = null;
      var keys = Object.keys(state.data.days);
      for (var i = 0; i < keys.length && !resumed; i++) {
        var arr = state.data.days[keys[i]];
        for (var j = 0; j < arr.length; j++) {
          if (arr[j].pendingGapStart && arr[j].status !== "done") { resumed = arr[j]; break; }
        }
      }
    }
    if (resumed && resumed.pendingGapStart) {
      state.runId = resumed.id;
      state.date = dayKeyOf(resumed);
      ensurePendingGap(resumed, Date.now());
    }

    /* Stage 8：PWA（可选增强；file:// 下自动跳过注册，安装按钮保持隐藏） */
    setupInstallPrompt();
    registerServiceWorker();
  }

  document.addEventListener("DOMContentLoaded", init);
  if (document.readyState !== "loading") init();
})();