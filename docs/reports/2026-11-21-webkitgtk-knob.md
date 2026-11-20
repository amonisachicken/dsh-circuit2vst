# dsh-circuit2vst 在 Tauri 客户端（WebKitGTK）里旋钮转不动 — 反馈

## 概要

在 DSH 的 **Tauri 桌面客户端**（Linux，WebKitGTK 内核）里，面板设计器预览中**任何手势都无法让旋钮转动**；同样的操作在 **Firefox / Chromium** 里一切正常。

定位结果：旋钮的旋转被写成**嵌套 `<svg>` 元素上的 `transform` 属性**，而 **WebKitGTK 不渲染该属性**（它属于 SVG 2，WebKitGTK 未实现）。于是拖动时数值、`rotate()` 属性都在变，**画面却永远不转**——用户看到的就是“拖不动”。

这是纯渲染层的兼容性问题，与上一轮“只认竖直位移”的手势问题**互相独立**：在手势正确的 Firefox/Chromium 里竖向拖动可以正常转动。

## 环境

| 项 | 值 |
|---|---|
| dsh-circuit2vst | `0.1.9`，commit `e3188248f3f61e8f346dcc57133db3893e968c4b` |
| DeepSeek Harness | `0.2.2-rc.1`（web profile） |
| Tauri 客户端 | Linux / **WebKitGTK 4.1**（`ss` 中可见 `WebKitNetworkProcess` 连到 GUI 端口） |
| 对照浏览器 | Firefox 160.0.1、Chromium（同机、同一 URL、同一设计） |
| 设计文件 | `sparklin-drive/design/panel.box.json`（canvas 60×112 mm，旋钮 k1/k2） |

## 现象

| 环境 | 竖向拖动旋钮 | 画面表现 |
|---|---|---|
| Firefox | 正常（75 px ≈ 78°） | 旋钮指针跟着转 |
| Chromium | 正常 | 旋钮指针跟着转 |
| **Tauri（WebKitGTK）** | 数值在变、`rotate()` 属性在变 | **画面完全不动** |

## 根因

旋钮贴图由 `placeAsset()` 生成，旋转被写成**内层 `<svg>` 的 `transform` 属性**：

```js
// vendor/boxdesigner/embed.js:79-88
export function placeAsset({ assetId, text, x, y, w, h, rot = 0 }) {
  const a = asset(assetId, text);
  const vb = a.viewBox.split(" ").map(Number);
  const size = [w ?? vb[2] * (25.4 / 72), h ?? vb[3] * (25.4 / 72)];
  const t = rot ? ` transform="rotate(${num(rot)} ${num(x + size[0] / 2)} ${num(y + size[1] / 2)})"` : "";
  return (
    `<svg x="${num(x)}" y="${num(y)}" width="${num(size[0])}" height="${num(size[1])}" ` +
    `viewBox="${a.viewBox}"${t}>${a.inner}</svg>`
  );
}
```

`transform` 作用在 `<svg>` 元素上是 **SVG 2** 的特性：

- **Chromium / Firefox**：支持，所以正常；
- **WebKitGTK**（Tauri Linux 的 WebView）：不支持，属性被忽略，旋钮永远停在 0°。

### 直接证据

用本机 WebKitGTK 渲染同一段标记（`rotate(0)` 与 `rotate(45)` 两个旋钮），`get_snapshot` 截图：

![WebKitGTK 忽略嵌套 svg 的 transform](/home/amon/dev/pedals/webkitgtk-nested-svg-transform.png)

两个旋钮**完全一样**，右侧的 `rotate(45)` 没有生效。

同一文件在 Chromium 中渲染，右侧旋钮明显旋转了约 45°——可对照上一轮的 `before.png` / `after.png`。

## 影响范围

不止预览旋钮，所有走 `placeAsset(..., rot)` 的元素都受影响：

| 场景 | 是否受影响 | 说明 |
|---|---|---|
| 面板设计器预览：旋钮角度 | ✅ | 旋转不显示 |
| 面板设计器编辑视图：带 `rot` 的 image 元素 | ✅ | 旋转不显示 |
| “写入素材（PNG）”/ 面板预览导出 | ⚠️ 可能 | `rasterize()` 用 WebView 自带的 SVG 渲染器把 `panelSvg()` 画进 canvas；WebKitGTK 下带 `rot` 的图元同样不会被旋转，导出的 PNG 会与设计不符 |
| 插件运行时的面板 GUI | ❌ | 运行时是 Rust/egui（`rustomp-gui`），不经过 WebView |
| Firefox / Chromium | ❌ | 正常 |

> 注意导出这一项：它意味着在 Tauri 里“写入素材”得到的 PNG，可能与在浏览器里得到的不一致。建议修复后回归对比。

## 修复建议

### 1. 把旋转从 `<svg>` 挪到外层 `<g>`（推荐）

`<g transform>` 是所有 SVG 引擎都支持的语法：

```diff
-  const t = rot ? ` transform="rotate(${num(rot)} ${num(x + size[0] / 2)} ${num(y + size[1] / 2)})"` : "";
-  return (
-    `<svg x="${num(x)}" y="${num(y)}" width="${num(size[0])}" height="${num(size[1])}" ` +
-    `viewBox="${a.viewBox}"${t}>${a.inner}</svg>`
-  );
+  const sprite =
+    `<svg x="${num(x)}" y="${num(y)}" width="${num(size[0])}" height="${num(size[1])}" ` +
+    `viewBox="${a.viewBox}">${a.inner}</svg>`;
+  if (!rot) return sprite;
+  const cx = num(x + size[0] / 2);
+  const cy = num(y + size[1] / 2);
+  return `<g transform="rotate(${num(rot)} ${cx} ${cy})">${sprite}</g>`;
```

注意两点：

- 旋转中心仍在**外层 mm 坐标系**（`x + w/2, y + h/2`），外层 `<g>` 正好工作在这个坐标系里；
- `withAttrs()` / `knobSprite()` 之后会用 `replace("<svg ", ...)` 打 `data-elid` / `data-control`，包一层 `<g>` 后第一个 `<svg ` 仍是精灵本身，替换行为不变；如果希望 `data-elid` 落在外层，可改为直接拼接属性。

### 2. 备选：CSS transform

也可以给 `<svg>` 加 `style="transform: rotate(...); transform-origin: ..."`。WebKitGTK 对 SVG 元素上的 CSS transform 支持较好，但 `transform-origin` 的单位/百分比在不同引擎上容易踩坑，**不如方案 1 稳**；若采用，需要在三个引擎上逐一验证旋转中心。

### 3. 加跨引擎回归测试

这类问题单元测试抓不到（数据、命中、`rotate()` 字符串都正确），必须验证**渲染结果**：

- 用 WebKitGTK 的 `WebKit2.WebView.get_snapshot()`（Python GI 十几行即可）对一段固定标记截图，断言 `rotate(45)` 与 `rotate(0)` 的像素不同；
- 或在 CI 里跑 WebKitGTK 的 `MiniBrowser` 截图对比；
- 至少把“Tauri 客户端里拖一下旋钮”加入发版前手动检查清单。

## 复现材料

最小复现页（三个引擎都能直接打开）：

```html
<svg width="400" height="150" xmlns="http://www.w3.org/2000/svg">
  <svg x="20" y="20" width="100" height="100" transform="rotate(0 70 70)">
    <circle cx="50" cy="50" r="45" fill="#333"/>
    <line x1="50" y1="50" x2="50" y2="12" stroke="#fff" stroke-width="4"/>
  </svg>
  <svg x="220" y="20" width="100" height="100" transform="rotate(45 270 70)">
    <circle cx="50" cy="50" r="45" fill="#333"/>
    <line x1="50" y1="50" x2="50" y2="12" stroke="#fff" stroke-width="4"/>
  </svg>
</svg>
```

- Chromium / Firefox：右侧指针旋转约 45°；
- WebKitGTK：两侧完全一致（见截图）。

## 临时规避（用户侧）

- 需要看旋钮/图元真实旋转时，在 **Firefox 或 Chromium** 里打开 DSH 编辑面板；
- Tauri 客户端里数值调整仍然有效（只是看不到旋转），保存后再用浏览器确认；
- 在 Tauri 里避免使用“写入素材（PNG）”，以免导出图形与设计不一致。

## 一句话结论

旋钮旋转写在了嵌套 `<svg>` 的 `transform` 上，Chromium/Firefox 支持（SVG 2）而 WebKitGTK 不支持，导致 Tauri 客户端里“数值在变、画面不转”；把旋转移到外层 `<g transform>` 即可，并建议补一个 WebKitGTK 渲染回归测试。
