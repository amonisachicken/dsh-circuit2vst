# 更新日志

## 0.1.10 — 2026-11-21

- **修复 Tauri（WebKitGTK）里旋钮转不动（外部反馈）**：`vendor/boxdesigner/embed.js` 的 `placeAsset()` 把 `rot` 写在
  **嵌套 `<svg>` 的 `transform`** 上——那是 SVG 2，WebKitGTK 不渲染（数值在变、画面不动）。
  改为外包一层 `<g transform="rotate(...)">`（旋转中心仍是外层的 mm 坐标），所有引擎通用；导出 PNG 与浏览器预览随之一致。
- `vendor/boxdesigner/PROVENANCE.md` 记录该本地补丁（上游升级时重打）。
- 新增单元用例：旋转的精灵必须是 `<g transform>` 包裹、内层 `<svg>` 不带 `transform`；0.5 位置不产生包裹。
- 反馈原文归档 `docs/reports/2026-11-21-webkitgtk-knob.md`。

## 0.1.9 — 2026-11-20

- **修复电路设计器命中判定与视觉层级相反（外部反馈 A）**：`circuitHitTest` 在距离相同时保留**先遍历到**（更早创建）的器件，
  而后创建的器件画在上层。改为**反向遍历**（后创建的先比较），距离相同时命中的就是看得见的那个。
  几何/命中函数也从画布移入 `circuit-netlist.js`（纯函数、可在 Node 里测试）。
- **修复模式首击被双击判定吞掉（外部反馈 B）**：`lastClickRef` 在进入任何编辑模式时清空；
  双击（属性 / OUT·测试点示波器）只在**视图模式且未拿起器件**时生效，复制/移动/放置/画线/删除模式优先消费点击。
- 新增 `test/hit-test.mjs`（5 个用例）：重叠器件命中后创建者、最近者优先、空点无命中、导线优先、外框合法；
  `npm test` **47/47**。
- 反馈原文归档 `docs/reports/2026-11-20-hit-test.md`。

## 0.1.8 — 2026-11-18

- **修复 git 安装后仿真/导入/对拍全部 ENOENT（外部反馈）**：`package.json` 的 `files` 白名单漏了 `vendor`，
  从 GitHub 安装的产物里没有 `vendor/circuit/`，于是 `models.lib` / `symbols.json` 读不到。已把 `vendor` 加入 `files`。
- 新增**打包自检** `test/pack-files.mjs`：跑 `npm pack --dry-run --json`，断言运行必需文件在 tarball 里
  （`vendor/circuit/models.lib`、`symbols.json`、`assets.gen.js`、`vendor/boxdesigner/*`、`client.js`…）——"仓库有、包里没有"只有打包断言能兜住。
- 缺 `vendor/` 时不再抛裸 `ENOENT`：`sim.js` / `verify.js` 会提示"安装包缺少 vendor/circuit（package.json 的 files 必须包含 vendor）"。
- 反馈原文归档 `docs/reports/2026-11-18-missing-vendor.md`。
- 验证：从真实 tarball 解包后直接跑 `runSimulation`（RC 低通，1010 点 `v(in)/v(out)`）与 `verifyCircuit`（`ok: true`）均通过。

## 0.1.7 — 2026-11-18

- **体检提示按平台给安装命令（外部反馈）**：ngspice 那行不再统一写 `brew install ngspice`。
  macOS → brew；Linux → `apt` / `pacman` / `dnf` 三种发行版写法；Windows → MSYS2 `pacman -S mingw-w64-x86_64-ngspice`。
  三平台都保留「从源码编译」的提示（`git clone … && ./autogen.sh && ./configure … && make`，配方见 docs/DETAIL.md）。
- python3 ≥ 3.11 的提示同样按平台给（Linux 不再提示 brew）。
- 新增两条单元用例：Linux 的 ngspice/python 提示不得出现 brew；三平台都必须保留源码编译命令。

## 0.1.6 — 2026-11-18

- **无项目时不再白屏（外部反馈）**：顶部的「面板设计器」「电路设计器」入口在**没有选中项目时灰显且不可点击**
  （`disabled` + tooltip「先创建项目，才能打开设计器」），不再进入空白设计器。
- 设计器视图本身也加了防护：即使项目在打开设计器期间被删除，也会显示「还没有选中项目 / 先创建或选择一个项目」
  的占位卡（带返回流程按钮），而不是白屏。

## 0.1.5 — 2026-11-18

- **修复面板 `读取失败：forbidden`（外部反馈）**：面板路由把 `webServer.register` 的第三个参数 `peer` 当鉴权依据，
  但 npm 版 Harness（如 0.2.2-rc.1）只调用 `handler(req, res)`，`peer` 恒为 `undefined`，owner 校验因此拒绝所有人。
  现在改为：有 `peer` 用 peer；没有则回退到 Harness `/api` 同款 `connection` 鉴权围栏
  （`connection.requestRejection(req)`，旧版用 `connection.admit(req)`），两者都不存在时按"本地无鉴权面"放行。
- 删除对不存在字段的依赖：`auth: 'required'` 在有该字段的宿主上仍生效，旧宿主会忽略（类型里没有），不再参与判断。
- 新增 `test/routes-auth.mjs`（5 个用例）覆盖三种分支：peer 注入 / `requestRejection` / `admit`，以及无鉴权面的降级。
- 反馈原文归档到 `docs/reports/2026-11-18-forbidden.md`。

## 0.1.4 — 2026-11-17

- **同步 rustomp-circuit-designer 的电位器阻值规范化（Freedist P2）**：
  - 电位器面板值写 `1M` 时，导出网表按 **meg** 处理（`0.5meg`，不再写成 `0.5M` 被 SPICE 当成 milli）；
  - 新增三条 lint：`pot-value-milli`（warn，提示改写成 `1meg`）、`pot-value-range`（error，超出 1 Ω…1 GΩ）、
    `pot-value-bad`（error，读不出数值）——电路设计器的网表卡片与徽标会直接显示；
  - 与上游 `backend/src/netlist.rs` 的 `half_value` / `panel_value_ohms` / `looks_like_mega_typo` 逐条对齐，并按其测试断言补了单元用例。

## 0.1.3 — 2026-11-17

- **钉到 rustomp v0.1.3**（`src/host/config.js`），配套 macOS 打包器升到 v0.1.8、Windows v0.3.0、Linux v0.1.0（对齐上游 `docs/status.md` §1 的兼容组合）。
- 上游 v0.1.3 带来的下游修复（本插件随之生效，无需改生成物）：
  - P0 固定电位端子上非线性器件的**雅可比重复计入**（DC 落到伪解，如 −147 V）；
  - P1 DC 求解加 **KCL 残差复检** + 换起点重试 + `strict_dc`；
  - P2 `1M` 不再被当成 milli（导入器硬校验 + 设计器规范成 `meg`）；
  - P5 `[ui]` 的整数字段不再被静默忽略。
- 验证：`freedist`（上游报告来源的 4×BJT 工程）在 v0.1.3 下 `generate`（漂移通过）、`verify`（ngspice 通过，OUT RMS 0.123 V）、`pack vst3`（mac 打包器 v0.1.8）全部通过。

## 0.1.2 — 2026-11-16

- 修复面板路由偶发未注册：`apply` 里用 `ctx.get('webServer')` 乐观查找，若浏览器载体稍后才注册，
  路由就被静默跳过，面板请求落到静态处理器（GET 404 / POST 405）。改为 `ctx.inject(['webServer'], …)`
  的 fork，路由随服务就绪自动挂载，工具在没有浏览器载体的组合里仍然可用。

## 0.1.1 — 2026-11-16

- 包名由 `@local/dsh-circuit2vst` 改为 **`dsh-circuit2vst`**（github 仓库同名），客户端 bundle id 同步重建；
- `install.sh` 写入的 profile 依赖因此变为 `dsh-circuit2vst`（升级用户需重启 DSH 让宿主按新 bundle id 加载）。

## 0.1.0 — 2026-11-16

首个公开版本：把 rustomp 的"电路 → DSP → 插件"流程搬进 DeepSeek Harness。

### 新增

- **DSH 插件骨架**：Host（`circuit2vst` 工具 + HTTP 路由）+ Client（React 面板），随 DSH 主题明暗切换。
- **面板设计器**（原生 React 移植，无 iframe）：拖放/图层/属性/撤销、12 px/mm 素材导出、`[ui]`/`[assets]` 幂等合并写入 `rustomp.toml`。
- **电路设计器**：网表引擎与上游逐字节对拍；画布/布线/模态编辑；符号库与示例库；存档/另存；导出网表与 PNG；元件属性含型号闭集下拉。
- **仿真**：ngspice 瞬态/AC、FFT、THD；IN 兼作波形发生器；双击 OUT/测试点打开示波器（仅设计器内部）。
- **代码生成**：`import`（`.design.json` → MNA Rust）、`generate`（外壳代码 + 漂移检查）、参数一致性校验。
- **启用界面** `enableGui`：幂等接上 `[build] gui`、egui 依赖、`plugin/src/editor.rs` 与模块钩子。
- **构建前对拍** `verify`：网表无 lint + ngspice 非静音（RMS ≥ 5 mV）+ 隐式连接审计；`pack` 默认强制。
- **打包**：macOS（VST3/AU/CLAP + DMG）、Windows（VST3/CLAP + MSI）、Linux（VST3/CLAP + tar.gz）。
- **安装脚本** `install.sh`：把仓库接进 DSH profile（依赖 + `dsh.profile.bundles` + `pnpm install`），支持 `--profile` / `--copy` / `--dry-run`。

### 修复

- Windows MSVC 体检改为 `vswhere` 探测，`canGenerate/canPack` 不再恒为 false。
- 框架 `new-plugin.sh` 的 TOML 路径反斜杠问题（`scriptPath` + `normalizeTomlPaths`）。
- 深色模式：品牌色按钮文字改用 `--dsw-alias-bg-base`；素材缩略图加纸白底。
- 参数校验把 `clip_indicator` 视为虚拟指示；项目焦点用 localStorage 记住。
- 基极导线穿过地引脚导致的隐式短路（Red Face）：新增隐式连接审计并在打包闸门中拦截。
