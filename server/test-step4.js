import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { existsSync, mkdirSync, unlinkSync } from 'node:fs'
import { spawn } from 'node:child_process'

function cleanupQuietly(paths) {
  for (const candidate of paths) {
    try {
      if (existsSync(candidate)) unlinkSync(candidate)
    } catch {
      // Windows can keep the WAL/DB files locked briefly after close.
    }
  }
}

mkdirSync('./data', { recursive: true })
const databasePath = `./data/test-step4.${Date.now()}.${process.pid}.db`

const server = spawn(process.execPath, ['server/index.js'], {
  env: { ...process.env, DATABASE_PATH: databasePath, PORT: '3104' },
  stdio: 'ignore',
})

async function waitForServer() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch('http://127.0.0.1:3104/api/emergencies')
      if (response.ok) return
    } catch { /* Server is still starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('Step 4 test server did not start.')
}

async function patch(path, body) {
  const response = await fetch(`http://127.0.0.1:3104${path}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(await response.text())
  return response.json()
}

try {
  await waitForServer()
  const db = new Database(databasePath)
  const now = new Date().toISOString()
  const addResponder = db.prepare("INSERT INTO users (name, role, verified, available, latitude, longitude, location_updated_at) VALUES (?, 'Doctor', 1, 1, ?, ?, ?)")
  const r1 = Number(addResponder.run('Responder One', 12.9716, 77.6006, now).lastInsertRowid) // ~0.65 km, 2 min
  const r2 = Number(addResponder.run('Responder Two', 12.9716, 77.6036, now).lastInsertRowid) // ~1.0 km, 3 min
  const r3 = Number(addResponder.run('Responder Three', 12.9716, 77.5956, now).lastInsertRowid) // ~0.1 km, 1 min
  const r4 = Number(addResponder.run('Expansion Responder', 12.9716, 77.6086, now).lastInsertRowid) // ~1.5 km
  const addEmergency = db.prepare("INSERT INTO emergencies (emergency_type, latitude, longitude, created_at, status, search_radius_km, matched_responder_ids, accepted_responder_ids, rejected_responder_ids) VALUES ('Accident', 12.9716, 77.5946, ?, 'Searching for nearby responders', 1, '[]', '[]', '[]')")

  const emergencyId = Number(addEmergency.run(now).lastInsertRowid)
  let result = await patch(`/api/emergencies/${emergencyId}/accept`, { responder_id: r1 })
  assert.equal(result.emergency.assigned_responder_id, r1, 'one acceptance becomes primary')
  assert.equal(result.emergency.primary_responder_eta_minutes, 2)

  result = await patch(`/api/emergencies/${emergencyId}/accept`, { responder_id: r2 })
  assert.equal(result.emergency.assigned_responder_id, r1, 'slower accepting responder remains secondary')
  assert.equal(result.emergency.accepted_count, 2)

  result = await patch(`/api/emergencies/${emergencyId}/accept`, { responder_id: r3 })
  assert.equal(result.emergency.assigned_responder_id, r3, 'later responder with a significantly better ETA becomes primary')
  assert.equal(result.emergency.accepted_count, 3)
  assert.deepEqual(result.emergency.accepted_responders.map((responder) => responder.assignment_role), ['primary', 'secondary', 'secondary'])

  const rejectedEmergencyId = Number(addEmergency.run(now).lastInsertRowid)
  await patch(`/api/emergencies/${rejectedEmergencyId}/reject`, { responder_id: r1 })
  await patch(`/api/emergencies/${rejectedEmergencyId}/reject`, { responder_id: r2 })
  result = await patch(`/api/emergencies/${rejectedEmergencyId}/reject`, { responder_id: r3 })
  assert.equal(result.emergency.assigned_responder_id, null)
  assert.equal(result.emergency.status, 'Searching for nearby responders', 'all rejections leave the emergency searching')

  // The production search expands after 30 seconds; make this safely older
  // than that threshold so the regression test does not depend on timing.
  const old = new Date(Date.now() - 31_000).toISOString()
  const expansionEmergencyId = Number(addEmergency.run(old).lastInsertRowid)
  const expansionResponse = await fetch(`http://127.0.0.1:3104/api/emergencies/${expansionEmergencyId}`)
  const expansion = (await expansionResponse.json()).emergency
  assert.equal(expansion.search_radius_km, 2, 'existing 1 km to 2 km expansion still runs')
  assert.ok(JSON.parse(expansion.matched_responder_ids).includes(r4), 'expanded search matches the responder in the second ring')
  db.close()
  console.log('Step 4 verification passed: primary selection, reassignment, backup retention, rejection flow, and radius expansion.')
} finally {
  server.kill('SIGKILL')
  await new Promise((resolve) => server.once('exit', resolve))
  cleanupQuietly([databasePath, `${databasePath}-shm`, `${databasePath}-wal`])
}
