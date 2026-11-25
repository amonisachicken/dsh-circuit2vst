# 来源：rustomp-circuit-designer（vendored 的符号与示例）

本目录是 [rustomp-circuit-designer](https://github.com/amonisachicken/rustomp-circuit-designer) 的
**符号资产与示例工程**，原样拷贝。网表生成器（`backend/src/netlist.rs`）不是拷贝，而是逐函数
移植到 `src/client/circuit-netlist.js`，并用「与上游后端逐字节对拍」守住一致性。

| 项 | 值 |
| --- | --- |
| 上游仓库 | `https://github.com/amonisachicken/rustomp-circuit-designer` |
| commit | `v0.2.1`（`578102d`，2026-11-24）—— 上一版基准 `f4eaa45`（2026-11-15） |
| 许可 | **GPL-3.0-or-later**（见上游 `LICENSE`） |
| 拷贝的文件 | `symbols/symbols.json`（21 个符号）、`assets/gb4728-symbols-kit/symbols/*.svg`（16 个）、`assets/gb4728-ext/symbols/*.svg`（5 个：test-point / nc / **inductor / transformer / triode**）、`frontend/public/examples/*.design.json`（4 个示例） |
| 不改的部分 | 上述文件一行未改；上游升级时整目录替换 |
| 未拷贝 | `assets/gb4728-symbols-kit.7z`（原稿压缩包，运行时不需要） |
| 另含 | `models.lib`（器件模型 + OP07A 宏模型 + **电子三极管 TRIODE 本体与 4 个型号子电路**，**只用于仿真**，不进交付网表） |

## 为什么 vendor

插件的 client 半是页面里的一个模块、不能 fetch 站外文件，而符号几何是**导出契约的一半**
（引脚坐标决定网表节点）。原样拷贝 + 对拍，比"运行时依赖上游仓库"稳得多。

## 上游更新步骤

```bash
git -C <上游 checkout> rev-parse HEAD
cp <上游>/symbols/symbols.json vendor/circuit/
rm -rf vendor/circuit/assets && cp -R <上游>/assets/gb4728-symbols-kit vendor/circuit/assets/ \
  && cp -R <上游>/assets/gb4728-ext vendor/circuit/assets/
# 保留 7z 与无关文件时按需裁剪
cp <上游>/frontend/public/examples/*.design.json vendor/circuit/examples/
node --test test/netlist-parity.mjs      # 与提交的黄金网表比对
```

若本机跑着上游后端（`127.0.0.1:3600`），对拍测试会自动追加**活体比对**。
