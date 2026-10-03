# 时块 BlockFlow · 提交包清单（Submission Package）

> **封版日期**：2026-10-04　|　**版本**：v1.0（Stage 0–9 全部完成）
> 本清单列出提交所需的全部文件及其用途。所有文件均为纯静态资源，零依赖、可直接运行。

## 一、应用运行时文件（必需）

| 文件 | 说明 |
| --- | --- |
| `index.html` | 应用入口（单页骨架，五个视图） |
| `styles.css` | 响应式样式、深色模式、可访问性 |
| `app.js` | 全部业务逻辑（原生 JS） |

## 二、PWA 增强文件（可选，http(s) 下生效）

| 文件 | 说明 |
| --- | --- |
| `manifest.webmanifest` | PWA 应用清单（固定 `id`/`start_url`/`scope`） |
| `service-worker.js` | 离线缓存（仅 Cache Storage，不触碰任务数据） |
| `icons/icon-192.png` | 应用图标 192×192 |
| `icons/icon-512.png` | 应用图标 512×512 |
| `icons/maskable-512.png` | 可遮罩图标 512×512 |

## 三、说明文档（必需）

| 文件 | 说明 |
| --- | --- |
| `README.md` | 运行、安装与测试说明（对外主文档） |
| `docs/product-spec.md` | 产品规格 |
| `docs/ui-spec.md` | 界面规格 |
| `docs/data-model.md` | 数据模型 |
| `docs/scheduling-rules.md` | 排期规则 |
| `docs/timer-rules.md` | 计时规则 |
| `docs/architecture.md` | 架构说明（本封版新增） |
| `docs/demo-script.md` | 90 秒演示脚本（本封版更新） |
| `docs/final-checklist.md` | 最终验收清单与真实测试结果（本封版新增） |
| `docs/known-limitations.md` | 已知限制（本封版新增） |
| `docs/submission-package.md` | 本文件：提交包清单 |
| `docs/decisions.md` | 设计决策记录（D-01 … D-26） |
| `docs/roadmap.md` | 阶段路线图 |
| `docs/handoff.md` | 交接文档 |

## 四、不包含（明确排除）

- 无 `node_modules`、无构建产物、无打包工具配置（本项目零依赖、无构建步骤）。
- 无后端代码、无数据库、无云服务配置。
- 无临时脚本 / 生成脚本（`_gen_icons.js`、各 `_check_*.js` 均已用后删除）。
- 无外部字体、图片、CDN 资源。

## 五、运行方式（评审快速上手）

1. **最简**：双击 `index.html` 即可（`file://`，无需任何服务）。
2. **启用 PWA**：在项目根目录执行 `python -m http.server 8080`，浏览器访问 `http://localhost:8080/`。
3. 详见 `README.md` 的「运行 / 预览」与「测试」章节。