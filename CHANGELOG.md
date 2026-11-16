# 更新日志

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
