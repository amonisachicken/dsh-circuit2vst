/**
 * Panel route authorization across Harness versions.
 *
 * Regression for the external report (2026-11-18): npm builds call a route
 * handler with `(req, res)` only, so a peer-only check rejected the owner too
 * and the panel showed `读取失败：forbidden`.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { authorizePanelRequest } from '../src/host/routes.js'

const OWNER = { principal: { kind: 'owner' } }
const GUEST = { principal: { kind: 'guest' } }
const req = { headers: { host: '127.0.0.1:46037' } }

/** Context whose `get` resolves the given services. */
function ctxWith(services) {
  return { get: (name) => services[name] }
}

test('a host that injects the admitted peer is trusted', () => {
  assert.equal(authorizePanelRequest(ctxWith({}), req, OWNER), undefined)
})

test('an injected non-owner peer is forbidden', () => {
  assert.equal(authorizePanelRequest(ctxWith({}), req, GUEST), 403)
})

test('without a peer the connection fence decides (requestRejection)', () => {
  const base = { get: () => ({ requestRejection: () => undefined }) }
  assert.equal(authorizePanelRequest(base, req, undefined), undefined)
  const denied = { get: () => ({ requestRejection: () => 403 }) }
  assert.equal(authorizePanelRequest(denied, req, undefined), 403)
  const anonymous = { get: () => ({ requestRejection: () => 401 }) }
  assert.equal(authorizePanelRequest(anonymous, req, undefined), 401)
})

test('builds that only expose admit() work too', () => {
  const owner = { get: () => ({ admit: () => ({ peer: OWNER }) }) }
  assert.equal(authorizePanelRequest(owner, req, undefined), undefined)
  const denied = { get: () => ({ admit: () => ({ rejection: 403 }) }) }
  assert.equal(authorizePanelRequest(denied, req, undefined), 403)
  const guest = { get: () => ({ admit: () => ({ peer: GUEST }) }) }
  assert.equal(authorizePanelRequest(guest, req, undefined), 403)
})

test('a composition without an auth surface stays usable', () => {
  assert.equal(authorizePanelRequest(ctxWith({}), req, undefined), undefined)
  assert.equal(authorizePanelRequest({ get: () => ({ requestRejection: () => { throw new Error('boom') } }) }, req, undefined), undefined)
})
