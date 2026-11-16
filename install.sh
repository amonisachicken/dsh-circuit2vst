#!/usr/bin/env bash
# Install this plugin into a DeepSeek Harness profile.
#
# A profile is a pnpm workspace under $DSH_HOME/profiles/<name>/: its
# package.json lists the plugin packages and `dsh.profile.bundles` decides what
# gets loaded. This script wires both, then runs `pnpm install`.
#
#   ./install.sh                     # link this checkout into the `web` profile
#   ./install.sh --profile dsh-tui   # another profile
#   ./install.sh --copy              # copy the repo into $DSH_HOME/plugins/<name>
#   ./install.sh --dry-run           # print the plan, change nothing
#
# Re-running is safe: the dependency entry is updated in place.
set -euo pipefail

NAME="$(node -e 'process.stdout.write(require("./package.json").name)')"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DSH_HOME="${DSH_HOME:-$HOME/.dsh}"
PROFILE="web"
MODE="link"
DRY_RUN="0"

usage() {
  sed -n '2,12p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile) PROFILE="${2:?--profile needs a name}"; shift 2 ;;
    --copy) MODE="copy"; shift ;;
    --dry-run) DRY_RUN="1"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "未知参数：$1" >&2; usage >&2; exit 2 ;;
  esac
done

PROFILE_DIR="$DSH_HOME/profiles/$PROFILE"
if [[ ! -d "$PROFILE_DIR" ]]; then
  echo "找不到 profile：$PROFILE_DIR" >&2
  echo "现有 profile：" >&2
  ls -1 "$DSH_HOME/profiles" >&2 || true
  exit 1
fi

TARGET="$REPO"
if [[ "$MODE" == "copy" ]]; then
  TARGET="$DSH_HOME/plugins/$NAME"
  echo "复制到 $TARGET"
  if [[ "$DRY_RUN" == "0" ]]; then
    rm -rf "$TARGET"
    mkdir -p "$(dirname "$TARGET")"
    # 只带运行所需的文件：源码、构建产物、文档与清单
    mkdir -p "$TARGET"
    cp -R "$REPO/." "$TARGET/"
    rm -rf "$TARGET/.git" "$TARGET/node_modules"
  fi
fi

SPEC="link:$TARGET"
echo "profile：$PROFILE_DIR"
echo "依赖：  $NAME → $SPEC"

if [[ "$DRY_RUN" == "1" ]]; then
  echo "（dry run：没有改动任何文件）"
  exit 0
fi

node - "$PROFILE_DIR/package.json" "$NAME" "$SPEC" <<'NODE'
const { readFileSync, writeFileSync } = require('node:fs')
const [file, name, spec] = process.argv.slice(2)
const pkg = JSON.parse(readFileSync(file, 'utf8'))
pkg.dependencies ??= {}
// Drop stale keys that point at this same checkout under an old name, and keep
// the bundle list in sync with the keys that actually exist.
const removed = []
for (const [key, value] of Object.entries(pkg.dependencies)) {
  if (key !== name && typeof value === 'string' && value.endsWith('/dsh-circuit2vst')) {
    delete pkg.dependencies[key]
    removed.push(key)
  }
}
pkg.dependencies[name] = spec
pkg.dsh ??= {}
pkg.dsh.profile ??= {}
// Keep framework bundles and real dependencies; drop leftovers of old names.
pkg.dsh.profile.bundles = (pkg.dsh.profile.bundles ?? []).filter(
  (entry) => entry.startsWith('@deepseek-ai/') || Object.prototype.hasOwnProperty.call(pkg.dependencies, entry),
)
if (!pkg.dsh.profile.bundles.includes(name)) pkg.dsh.profile.bundles.push(name)
writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n')
console.log('已写入 ' + file)
NODE

if command -v pnpm >/dev/null 2>&1; then
  echo "安装依赖（pnpm install）…"
  (cd "$PROFILE_DIR" && pnpm install --silent)
else
  echo "没有 pnpm：请手动在 $PROFILE_DIR 运行 pnpm install" >&2
  exit 1
fi

echo
echo "完成。下一步："
echo "  1) 重启 DSH（例如重新运行 dsh web），或刷新页面"
echo "  2) 侧栏出现 Circuit2VST；若没有，到 DSH 的插件管理里确认 $NAME 已启用"
