# dsh-circuit2vst 面板报 `读取失败：forbidden` — 问题反馈

## 概要

安装 `dsh-circuit2vst@0.1.4`（commit `13b8dcdd3d06d46844a409bb3ba31610064520dc`）后，Web GUI 里插件面板无法加载数据，界面显示 **`读取失败：forbidden`**；面板路由 `/plugin/circuit2vst/api` 对任何请求都返回 `403 {"error":"forbidden"}`。

agent 侧的 `circuit2vst` 工具不受影响（`status` 等动作正常），问题只出在面板用的 HTTP 路由上。

## 环境

| 项 | 值 |
|---|---|
| DeepSeek Harness | `0.2.2-rc.1`（npx 缓存 `1e7f6d9597241db0`） |
| dsh-circuit2vst | `0.1.4`，commit `13b8dcdd3d06d46844a409bb3ba31610064520dc` |
| profile | `web` |
| 系统 | Linux（CachyOS），`7.3.3-1-cachyos` |
| 访问方式 | GUI `http://127.0.0.1:46037`（loopback，本机浏览器，已认证会话） |

## 复现步骤

1. 安装插件到 `web` profile（安装本身成功，回执 HTTP 201）。
2. 启动 / 刷新 `dsh web`，在 GUI 中打开 Circuit2VST 面板。
3. 面板显示 `读取失败：forbidden`，不显示环境体检、依赖、项目等任何状态。

## 根因

插件面板路由把 **`webServer.register` 的 handler 第三个参数 `peer`** 当作已经由 Harness 注入，并以此做 owner 校验：

```js
// src/host/routes.js（0.1.4）
return webServer.register({
  kind: 'prefix',
  path: ROUTE_PREFIX,          // '/plugin/circuit2vst'
  auth: 'required',
  handler: async (req, res, peer) => {
    if (peer?.principal?.kind !== 'owner') {
      json(res, 403, { error: 'forbidden' })
      return
    }
    ...
```

但当前 DSH 的 `webServer.register` **不会传第三个参数**，类型签名明确只有两个参数：

```ts
// @deepseek-ai/dsh-host-webserver/lib/types/index.d.ts:44
export interface WebRoute {
    kind: WebRouteKind;
    path: string;
    handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;
}
```

调用点同样只传两个实参（`lib/index.js` 的请求分发：`await responder.handler(req, res)`）。

因此：

- `peer` 恒为 `undefined`；
- `peer?.principal?.kind !== 'owner'` 恒为 `true`；
- 路由在进入任何业务逻辑前就返回 `403 {"error":"forbidden"}`。

另外 `auth: 'required'` 也不是本版 `WebRoute` 支持的字段（类型里没有 `auth`），属于同一处 API 假设。

### 关键证据

未携带任何凭据直接探测（若鉴权生效应返回 `401 unauthorized`，实际返回了插件自己的 403 JSON，说明鉴权层根本没介入）：

```text
$ curl -i http://127.0.0.1:46037/plugin/circuit2vst/api
HTTP/1.1 403 Forbidden
content-type: application/json; charset=utf-8
content-length: 21

{"error":"forbidden"}
```

同时确认 `0.2.2-rc.3`（当前 npm 最新）的 `dsh-host-webserver` 类型 **没有** 该差异：`WebRoute.handler` 仍是 `(req, res)`。即这不是“版本落后”，而是插件用了一个 Harness 尚未提供的 API。

### 鉴权应走的入口

本版 Harness 的浏览器鉴权在 `@deepseek-ai/dsh-client-connection` 的 `connection` 服务上：

```js
// @deepseek-ai/dsh-client-connection/lib/index.js:737
/** Apply the Host/Origin fence and require an authenticated live Peer. */
requestRejection(request) {
  const admission = this.admit(request);
  return 'rejection' in admission ? admission.rejection : void 0;
}
```

`/api` 通道自己就是这么做的：`connection.admit(req)`，失败时回 `401 unauthorized` / `403 forbidden`（见同文件 `apply()` 里注册的 `/api` prefix 路由）。插件的 `/plugin/circuit2vst` 路由绕过了这套机制，自己用一个不存在的 `peer` 做判断。

## 本地临时修补（供参考，非上游方案）

在 `peer === undefined` 时回退到 `connection.requestRejection(req)`，与 `/api` 通道同一套 Host/Origin 围栏 + 浏览器 cookie 校验：

```diff
--- a/src/host/routes.js
+++ b/src/host/routes.js
@@ -82,9 +82,17 @@
     path: ROUTE_PREFIX,
     auth: 'required',
     handler: async (req, res, peer) => {
-      if (peer?.principal?.kind !== 'owner') {
-        json(res, 403, { error: 'forbidden' })
-        return
+      if (peer === undefined) {
+        // 本版 Harness 不注入 peer，改用 connection 的鉴权入口
+        const connection = ctx.get('connection')
+        const rejection = connection?.requestRejection?.(req)
+        if (rejection !== undefined) {
+          json(res, rejection, { error: rejection === 401 ? 'unauthorized' : 'forbidden' })
+          return
+        }
+      } else if (peer?.principal?.kind !== 'owner') {
+        json(res, 403, { error: 'forbidden' })
+        return
       }
```

隔离进程验证三分支：

| 场景 | 结果 |
|---|---|
| 未认证 | `401 {"error":"unauthorized"}` |
| 跨站 / Host·Origin 不可信 | `403 {"error":"forbidden"}` |
| 已认证 owner | `200`，正常返回 `state` |

（该修补位于 `~/.dsh/profiles/web/node_modules/`，重装或升级插件会被覆盖。）

## 建议上游修复方向

任选其一，按目标 Harness 版本确认后落地：

1. **改用 `connection` 鉴权**（推荐）：`ctx.inject(['connection'], …)` 拿到 `connection`，在 handler 首行调用 `connection.requestRejection(req)`；有拒绝就按其状态码返回，不再依赖不存在的 `peer`。
2. **改用 Connection RPC / Fetch 注册表**：通过 `ctx.connection.rpc.handle()` 或 `ctx.connection.fetch.register()` 注册面板通道，让 Harness 统一做鉴权与 peer 注入，插件不再自己判断 owner。
3. **保留兼容分支**：若确需兼容会注入 `peer` 的较新版本，用 `peer === undefined` 做降级（即上面的临时补丁形态），并去掉无效的 `auth: 'required'` 字段，避免误导。

另建议在 `package.json` 声明所需 Harness 版本（`engines.dsh` 或 peer 依赖），让安装阶段就能拦下不兼容组合，而不是装完后在面板里报 403。

## 附：不相关的环境提示

面板加载后会显示依赖未就绪（`cargo-nih-plug` 未安装、rustomp 框架与打包器未 `prepare`）。这与本 403 问题无关，是安装后尚未执行 `prepare` 的正常状态。
