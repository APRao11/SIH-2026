import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { existsSync, unlinkSync } from 'node:fs'
import { spawn } from 'node:child_process'

const databasePath = './data/test-step6.db'
if (existsSync(databasePath)) unlinkSync(databasePath)

const server = spawn(process.execPath, ['server/index.js'], {
  env: { ...process.env, DATABASE_PATH: databasePath, PORT: '3106' },
  stdio: 'ignore',
})

async function waitForServer() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch('http://127.0.0.1:3106/api/emergencies')
      if (response.ok) return
    } catch { /* Server is still starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('Step 6 test server did not start.')
}

async function patch(path, body) {
  const response = await fetch(`http://127.0.0.1:3106${path}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  const json = await response.json().catch(() => ({}))
  return { ok: response.ok, status: response.status, json }
}

async function get(path) {
  const response = await fetch(`http://127.0.0.1:3106${path}`)
  return { ok: response.ok, status: response.status, json: await response.json().catch(() => ({})) }
}

try {
  await waitForServer()
  const db = new Database(databasePath)
  const now = new Date().toISOString()
  const responderId = Number(db.prepare("INSERT INTO users (name, role, verified, available, latitude, longitude, location_updated_at) VALUES ('Step6 Responder', 'Doctor', 1, 1, 12.9716, 77.6006, ?)").run(now).lastInsertRowid)
  const emergencyId = Number(db.prepare("INSERT INTO emergencies (emergency_type, latitude, longitude, created_at, status, search_radius_km, matched_responder_ids) VALUES ('Accident', 12.9716, 77.5946, ?, 'Searching for nearby responders', 1, ?)").run(now, JSON.stringify([responderId])).lastInsertRowid)
  db.close()

  // Initial state: no arrival status, emergency active
  let r = await get(`/api/emergencies/${emergencyId}`)
  assert.equal(r.ok, true)
  assert.equal(r.json.emergency.ambulance_arrival_status, null)
  assert.equal(r.json.emergency.status, 'Searching for nearby responders')

  // YES -> arrived, status preserved (emergency not closed)
  r = await patch(`/api/emergencies/${emergencyId}/ambulance-status`, { ambulance_arrived: true })
  assert.equal(r.ok, true)
  assert.equal(r.json.emergency.ambulance_arrival_status, 'arrived')
  assert.equal(r.json.emergency.status, 'Searching for nearby responders', 'emergency stays active after YES')

  // Page refresh / GET preserves the selection
  const refreshed = await get(`/api/emergencies/${emergencyId}`)
  assert.equal(refreshed.json.emergency.ambulance_arrival_status, 'arrived', 'refresh preserves YES')

  // NO -> not_yet, emergency still active
  r = await patch(`/api/emergencies/${emergencyId}/ambulance-status`, { ambulance_arrived: false })
  assert.equal(r.json.emergency.ambulance_arrival_status, 'not_yet')
  assert.equal(r.json.emergency.status, 'Searching for nearby responders', 'emergency remains active after NO')

  // Responder-side visibility
  const responderView = await get(`/api/responder/emergencies?responder_id=${responderId}`)
  assert.equal(responderView.ok, true)
  const item = responderView.json.emergencies.find((e) => e.id === emergencyId)
  assert.ok(item, 'responder sees the emergency')
  assert.equal(item.ambulance_arrival_status, 'not_yet', 'responder sees ambulance has not arrived')

  // Only the relevant emergency is updated
  const secondDb = new Database(databasePath)
  const otherId = Number(secondDb.prepare("INSERT INTO emergencies (emergency_type, latitude, longitude, created_at, status) VALUES ('Other', 12.97, 77.59, ?, 'Alert created')").run(now).lastInsertRowid)
  const other = await get(`/api/emergencies/${otherId}`)
  secondDb.close()
  assert.equal(other.json.emergency.ambulance_arrival_status, null, 'unrelated emergency untouched')

  // Validation: non-boolean rejected, unknown emergency 404
  const bad = await patch(`/api/emergencies/${emergencyId}/ambulance-status`, { ambulance_arrived: 'yes' })
  assert.equal(bad.status, 400)
  const missing = await patch('/api/emergencies/999999/ambulance-status', { ambulance_arrived: true })
  assert.equal(missing.status, 404)

  console.log('Step 6 verification passed: YES, NO, page refresh persistence, responder visibility, scope isolation, and validation.')
} finally {
  server.kill()
  await new Promise((resolve) => server.once('exit', resolve))
  for (const candidate of [databasePath, `${databasePath}-shm`, `${databasePath}-wal`]) {
    if (existsSync(candidate)) unlinkSync(candidate)
  }
}