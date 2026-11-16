/**
 * Making a project's self-drawn GUI reachable.
 *
 * A scaffolded project is **headless by design**: the template sets
 * `[build] gui = false`, comments out the egui dependencies and ships no
 * `editor.rs`. The panel designer can merge `[ui]` / `[assets]` into the
 * manifest, but that alone produces a plugin whose panel images are compiled in
 * and never drawn — the host shows the generic parameter list instead.
 *
 * This step wires the four hand-written pieces idempotently, so "new project →
 * panel designer → pack" yields a plugin with the drawn panel:
 *
 * 1. `[build] gui = true`;
 * 2. `rustomp-gui` in the workspace dependencies;
 * 3. `nih_plug_egui` + `rustomp-gui` in the plugin, with `default = ["gui"]`;
 * 4. `plugin/src/editor.rs` (written from a template when missing) and the
 *    `#[cfg(feature = "gui")] mod editor;` hook in `plugin/src/lib.rs`.
 *
 * It never overwrites an existing `editor.rs`: hand-written editors are the
 * intended extension point.
 */
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/** Pin used when the project's `nih_plug` dependency cannot be read. */
const FALLBACK_NIH_REV = 'de42101'

/** The hand-written editor the generated `plugin_impl.rs` calls. */
const EDITOR_TEMPLATE = `// SPDX-License-Identifier: GPL-3.0-or-later

//! **手写的界面层**：把 \`rustomp-gui\` 的声明式面板接到 nih-plug 的参数上。
//!
//! 分工：
//! - **生成的**：\`generated/panel.rs\`（面板布局，来自 \`rustomp.toml\` 的 \`[ui]\`）、
//!   \`generated/params.rs\`（参数表）、\`generated/plugin_impl.rs\`（插件实现）、
//!   \`generated/bridge.rs\`（参数桥）、\`generated/assets.rs\`（素材字节）；
//! - **手写的**（本文件）：只有"创建 egui 编辑器"这几十行。

use nih_plug::prelude::*;
use nih_plug_egui::{create_egui_editor, egui};
use std::sync::{
    atomic::{AtomicU32, Ordering},
    Arc,
};

use crate::generated::assets::{IMAGES, PANEL_PNG};
use crate::generated::bridge::ParamBridge;
use crate::generated::panel::PANEL;
use crate::generated::params::PluginParams;

static ASSETS: rustomp_gui::Assets = rustomp_gui::Assets {
    panel: PANEL_PNG,
    images: IMAGES,
};

/// 由生成的 \`plugin_impl.rs\` 在 \`gui\` feature 打开时调用。
pub fn make(params: Arc<PluginParams>, activity: Arc<AtomicU32>) -> Option<Box<dyn Editor>> {
    create_egui_editor(
        params.editor_state.clone(),
        rustomp_gui::UiState::default(),
        |ctx, state| {
            ctx.set_visuals(egui::Visuals::light());
            // 新建 egui Context 后旧纹理句柄全部失效，必须清空重建
            rustomp_gui::reset_textures(state);
        },
        move |ctx, setter, state| {
            let level = f32::from_bits(activity.load(Ordering::Relaxed));
            let access = ParamBridge {
                params: &params,
                setter,
                activity: level,
            };
            egui::CentralPanel::default()
                .frame(egui::Frame::NONE)
                .show(ctx, |ui| {
                    rustomp_gui::draw(ui, &PANEL, &ASSETS, state, &access, level);
                });
        },
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 面板声明必须自洽：贴图名都存在、尺寸合法。
    #[test]
    fn generated_panel_is_valid() {
        let errs = rustomp_gui::validate_panel(&PANEL, &ASSETS);
        assert!(errs.is_empty(), "面板校验失败：{errs:#?}");
    }
}
`

/**
 * Read a file if it exists.
 * @param path - absolute path.
 * @returns the text, or null.
 */
async function readIfPresent(path) {
  if (!existsSync(path)) return null
  return readFile(path, 'utf8')
}

/**
 * Ensure the `[build]` table sets `gui = true`.
 * @param text - rustomp.toml contents.
 * @returns `{text, changed}`.
 */
export function enableInManifest(text) {
  const lines = text.split('\n')
  const buildIndex = lines.findIndex((line) => line.trim() === '[build]')
  if (buildIndex < 0) {
    const next = `${text.trimEnd()}\n\n[build]\ngui = true\n`
    return { text: next, changed: true }
  }
  const end = lines.findIndex((line, index) => index > buildIndex && /^\[/.test(line.trim()))
  const stop = end < 0 ? lines.length : end
  for (let index = buildIndex + 1; index < stop; index += 1) {
    if (/^\s*gui\s*=\s*true\b/.test(lines[index])) return { text, changed: false }
    if (/^\s*gui\s*=\s*false\b/.test(lines[index])) {
      lines[index] = lines[index].replace(/false/, 'true')
      return { text: lines.join('\n'), changed: true }
    }
  }
  lines.splice(buildIndex + 1, 0, 'gui = true')
  return { text: lines.join('\n'), changed: true }
}

/**
 * Ensure `[workspace.dependencies]` exposes `rustomp-gui`.
 * @param text - workspace Cargo.toml contents.
 * @returns `{text, changed}`.
 */
export function enableWorkspaceDependency(text) {
  const lines = text.split('\n')
  const headerIndex = lines.findIndex((line) => line.trim() === '[workspace.dependencies]')
  if (headerIndex < 0) return { text, changed: false, error: '工作区 Cargo.toml 里没有 [workspace.dependencies]' }
  const end = lines.findIndex((line, index) => index > headerIndex && /^\[/.test(line.trim()))
  const stop = end < 0 ? lines.length : end
  for (let index = headerIndex + 1; index < stop; index += 1) {
    if (/^\s*rustomp-gui\s*=/.test(lines[index])) return { text, changed: false }
  }
  let inserted = null
  for (let index = headerIndex + 1; index < stop; index += 1) {
    const match = /^(\s*)rustomp-dsp\s*=\s*\{\s*path\s*=\s*"([^"]*)"\s*\}/.exec(lines[index])
    if (match !== null) {
      const path = match[2].replace(/rustomp-dsp\/?$/, 'rustomp-gui')
      inserted = `${match[1]}rustomp-gui = { path = "${path}" }`
      lines.splice(index + 1, 0, inserted)
      break
    }
  }
  if (inserted === null) return { text, changed: false, error: '找不到 rustomp-dsp 的 path 依赖，无法推导 rustomp-gui 的路径' }
  return { text: lines.join('\n'), changed: true }
}

/**
 * Ensure the plugin crate depends on egui and builds the GUI feature by default.
 * @param text - plugin/Cargo.toml contents.
 * @returns `{text, changed}`.
 */
export function enablePluginDependencies(text) {
  const lines = text.split('\n')
  const nihIndex = lines.findIndex((line) => /^\s*nih_plug\s*=\s*\{/.test(line))
  const revMatch = nihIndex < 0 ? null : /rev\s*=\s*"([^"]+)"/.exec(lines[nihIndex])
  const rev = revMatch === null ? FALLBACK_NIH_REV : revMatch[1]
  let changed = false

  const hasEgui = lines.some((line) => /^\s*nih_plug_egui\s*=/.test(line))
  if (!hasEgui) {
    const line = `nih_plug_egui = { git = "https://github.com/robbert-vdh/nih-plug.git", rev = "${rev}" }`
    if (nihIndex >= 0) lines.splice(nihIndex + 1, 0, line)
    else lines.push('', line)
    changed = true
  }
  const hasGui = lines.some((line) => /^\s*rustomp-gui\s*=/.test(line))
  if (!hasGui) {
    const eguiIndex = lines.findIndex((line) => /^\s*nih_plug_egui\s*=/.test(line))
    const line = 'rustomp-gui = { workspace = true }'
    if (eguiIndex >= 0) lines.splice(eguiIndex + 1, 0, line)
    else lines.push(line)
    changed = true
  }
  const featuresIndex = lines.findIndex((line) => line.trim().startsWith('default ='))
  if (featuresIndex >= 0 && !/gui/.test(lines[featuresIndex])) {
    lines[featuresIndex] = 'default = ["gui"]'
    changed = true
  }
  return { text: lines.join('\n'), changed }
}

/**
 * Ensure `lib.rs` mounts the editor module under the gui feature.
 * @param text - plugin/src/lib.rs contents.
 * @returns `{text, changed}`.
 */
export function enableEditorHook(text) {
  if (/mod\s+editor\s*;/.test(text)) return { text, changed: false }
  const next = text.replace(
    /(\nmod generated;\n)/,
    '$1\n/// 手写的界面层（`plugin_impl.rs` 里的 `gui` feature 钩子会调用 `editor::make`）\n#[cfg(feature = "gui")]\nmod editor;\n',
  )
  if (next !== text) return { text: next, changed: true }
  return { text: `${text.trimEnd()}\n\n#[cfg(feature = "gui")]\nmod editor;\n`, changed: true }
}

/**
 * Enable the self-drawn GUI for one project.
 * @param projectDir - project root.
 * @returns `{changed: string[], alreadyEnabled, errors: string[]}`.
 */
export async function enableGui(projectDir) {
  const changed = []
  const errors = []
  const write = async (relative, result) => {
    if (result.changed) {
      await writeFile(join(projectDir, relative), result.text, 'utf8')
      changed.push(relative)
    }
    if (result.error !== undefined) errors.push(`${relative}: ${result.error}`)
  }

  const manifestPath = join(projectDir, 'rustomp.toml')
  const manifest = await readIfPresent(manifestPath)
  if (manifest === null) throw new Error('没有 rustomp.toml：这不是一个插件工程')
  if (!/^\s*\[ui\]\s*$/m.test(manifest)) {
    errors.push('rustomp.toml: 没有 [ui] 面板段 —— 先在面板设计器里「写入 rustomp.toml」，否则 rustomp-gen 会拒绝生成')
  }
  await write('rustomp.toml', enableInManifest(manifest))

  const workspace = await readIfPresent(join(projectDir, 'Cargo.toml'))
  if (workspace !== null) await write('Cargo.toml', enableWorkspaceDependency(workspace))

  const pluginManifest = await readIfPresent(join(projectDir, 'plugin', 'Cargo.toml'))
  if (pluginManifest === null) throw new Error('没有 plugin/Cargo.toml：这不是一个插件工程')
  await write('plugin/Cargo.toml', enablePluginDependencies(pluginManifest))

  const editorPath = join(projectDir, 'plugin', 'src', 'editor.rs')
  if (!existsSync(editorPath)) {
    await writeFile(editorPath, EDITOR_TEMPLATE, 'utf8')
    changed.push('plugin/src/editor.rs')
  }

  const lib = await readIfPresent(join(projectDir, 'plugin', 'src', 'lib.rs'))
  if (lib !== null) await write('plugin/src/lib.rs', enableEditorHook(lib))
  else errors.push('plugin/src/lib.rs: 找不到插件入口文件')

  return { changed, alreadyEnabled: changed.length === 0, errors }
}
