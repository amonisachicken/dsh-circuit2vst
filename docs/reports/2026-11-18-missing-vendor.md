# dsh-circuit2vst 0.1.7 从 git 安装后无法仿真 — 反馈

## 概要

把插件从 GitHub 装进 `web` profile 后，电路设计器点「仿真」始终失败；同一份电路在仓库内直接跑是正常的。排查发现是**打包时漏了 `vendor/` 目录**：`package.json` 的 `files` 没有列 `vendor`，导致 `models.lib` 与 `symbols.json` 不在安装产物里。

受影响的**不只是仿真**，所有读取 `vendor/circuit/` 的入口都会 `ENOENT`：

| 入口 | 读取的文件 | 结果 |
|---|---|---|
| 仿真（`.tran` / `.ac` / …） | `vendor/circuit/models.lib` | `ENOENT`，抛错 |
| 导入 `.design.json` | `vendor/circuit/symbols.json` | `ENOENT`，抛错 |
| `verify`（pack 前的对拍门禁） | `symbols.json` + `models.lib` | `ENOENT`，`pack` 也随之失败 |

## 环境

| 项 | 值 |
|---|---|
| dsh-circuit2vst | `0.1.7`，commit `47a036b88f8acd54e12fde48c05cc54aa5d7ce74` |
| 安装方式 | `dsh plugin --profile web add github:amonisachicken/dsh-circuit2vst#<commit>`（pnpm） |
| DeepSeek Harness | `0.2.2-rc.1` |
| ngspice | `ngspice-47`（`/usr/bin/ngspice`，体检 ✓） |
| 系统 | CachyOS Linux |

## 复现

工程 `fet-bender` 下画了一个 RC 低通（`circuit/test.design.json`：R1 10k、C1 100n、IN/OUT/GND），点仿真。

网表生成本身完全正常，无 lint：

```
* test —— 由 rustomp-circuit-designer 生成
* @rustomp in=IN out=OUT

C1 OUT 0 100n
R1 IN OUT 10k
.end
```

但主机侧 `sim.js` 在拼 batch 网表时读模型库直接抛：

```
Error: ENOENT: no such file or directory,
open '.../node_modules/dsh-circuit2vst/vendor/circuit/models.lib'
    at modelsLib (src/host/sim.js:36)
    at buildBatch (src/host/sim.js:134)
```

## 根因

`src/host/sim.js:23` 与 `src/host/config.js:16`、`src/host/verify.js:107/129` 都以包根目录为基准读 `vendor/circuit/`：

```js
// src/host/sim.js
const MODELS_PATH = new URL('../../vendor/circuit/models.lib', import.meta.url)

// src/host/config.js
export const DESIGNER_SYMBOLS = join(PLUGIN_ROOT, 'vendor/circuit/symbols.json')
```

而 `package.json` 的 `files` 白名单里没有 `vendor`：

```json
"files": [
  "index.js",
  "client.js",
  "cordis.patch.yml",
  "src",
  "locale/*.json",
  "docs",
  "icon.svg"
]
```

仓库里 `vendor/circuit/` 是存在的（`models.lib`、`symbols.json`、`assets/`、`examples/`、`PROVENANCE.md`、`assets.gen.js`），但 pnpm 从 git 安装时会按 `files` 打包，于是整个 `vendor` 被裁掉。

这解释了为什么“仓库里能跑、装进 profile 就废”：仓库内 `vendor/` 在，安装产物里没有。

## 验证与临时绕过

从仓库该 commit 补齐被裁掉的文件后，同一份电路立即仿真成功：

```sh
cd ~/.dsh/profiles/web/node_modules/dsh-circuit2vst
mkdir -p vendor/circuit
BASE=https://raw.githubusercontent.com/amonisachicken/dsh-circuit2vst/<commit>/vendor/circuit
for f in models.lib symbols.json PROVENANCE.md; do curl -sS -o "vendor/circuit/$f" "$BASE/$f"; done
```

结果：

```
--- batch ---
VSIM IN 0 DC 0 SIN(0 1 1000 0 0 0)
C1 OUT 0 100n
R1 IN OUT 10k
...
.tran 0.0001 0.01 0
--- ok --- tran traces: [ 'v(in)', 'v(out)' ]
```

注意：这只是本地绕过，**重装/升级会被覆盖**。

## 建议修复

1. **把 `vendor` 加进 `files`**（根本修复）：

   ```diff
    "files": [
      "index.js",
      "client.js",
      "cordis.patch.yml",
      "src",
      "locale/*.json",
      "docs",
      "icon.svg",
   +  "vendor"
    ]
   ```

   如果只想带仿真所需的最小集，可以精确列 `"vendor/circuit/models.lib"`、`"vendor/circuit/symbols.json"`（以及 `import` 可能用到的 `assets/`、`examples/`）。

2. **加一条打包自检**：`npm run test` 或发布前脚本里断言 `vendor/circuit/models.lib` 与 `symbols.json` 存在，并模拟 `npm pack` 后检查产物包含它们——这类“仓库有、包里没有”的问题只有打包断言能兜住。

3. **错误信息更可诊断**（可选）：`modelsLib()` / `DESIGNER_SYMBOLS` 读取失败时，报“安装包缺少 vendor/circuit（请检查 package.json files）”而不是裸 `ENOENT`，面板也能给出可读提示。

## 附：与本次无关

- `ngspice-47` 已安装且被体检识别，仿真链路本身（网表生成 → batch → ngspice → 波形解析）没有问题。
- 电路本身没有 lint 错误，`ports`/`nets`/`dangling` 均正常。
