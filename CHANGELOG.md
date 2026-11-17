# 更新日志

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
