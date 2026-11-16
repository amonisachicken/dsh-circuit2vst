# 来源：rustomp-box-designer（vendored）

本目录是 [rustomp-box-designer](https://github.com/amonisachicken/rustomp-box-designer) 的
**纯逻辑部分**，原样拷贝，用来在 DSH 插件里以 React 重画界面、但导出结果与上游逐字节一致。

| 项 | 值 |
| --- | --- |
| 上游仓库 | `https://github.com/amonisachicken/rustomp-box-designer` |
| commit | `0716a7f18b3dfa5d61ebe7988f550b9a662a8a05`（2026-11-15） |
| 许可 | **GPL-3.0-or-later**（见上游 `LICENSE`） |
| 拷贝的文件 | `src/model.js`、`src/exporter.js`、`src/embed.js`、`src/assets.gen.js`、`assets/**/*.svg`（32 个） |
| 不改的部分 | 上述文件**一行未改**，上游升级时整目录替换即可 |
| 生成的文件 | `assets.text.js`（`scripts/gen-asset-text.mjs` 把 SVG 文本内联成 JS map，浏览器 bundle 不需要额外路由） |

## 为什么 vendor 而不是运行时读上游

DSH 的 client 插件是页面里的一个模块，不能 `fetch` 站外文件，也不能 import 未打包的 ESM；
而“导出必须和上游一致”是硬要求（`ui.toml` 会进 `rustomp.toml`，一旦偏移就是另一块面板）。
所以把纯函数原样搬进来、UI 重写：导出走同一份 `uiToml()`。

## 上游更新步骤

```bash
git -C <上游 checkout> rev-parse HEAD          # 记下新 commit
cp <上游>/src/{model,exporter,embed,assets.gen}.js vendor/boxdesigner/
rm -rf vendor/boxdesigner/assets && cp -R <上游>/assets vendor/boxdesigner/assets
node scripts/gen-asset-text.mjs                # 重新生成 assets.text.js
node scripts/build-client.mjs                  # 重新生成 client.js
node --test test/export-parity.mjs             # 与上游 CLI 的 ui.toml 逐字节比对
```

`test/export-parity.mjs` 会用上游 `scripts/export.mjs` 处理同一份 `.box.json`，两份 `ui.toml` 必须相等。
