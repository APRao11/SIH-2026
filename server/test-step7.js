import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { existsSync, unlinkSync } from 'node:fs'
import { spawn } from 'node:child_process'
import firstAidGuidance, { FIRST_AID_SAFETY_MESSAGE, getFirstAidGuidance } from '../src/lib/firstAidGuidance.js'

const databasePath = './data/test-step7.db'
if (existsSync(databasePath)) unlinkSync(databasePath)

const server = spawn(process.execPath, ['server/index.js'], {
  env: { ...process.env, DATABASE_PATH: databasePath, PORT: '3107' },
  stdio: 'ignore',
})

async function waitForServer() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch('http://127.0.0.1:3107/api/emergencies')
      if (response.ok) return
    } catch { /* Server is still starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('Step 7 test server did not start.')
}

async function post(path, body) {
  const response = await fetch(`http://127.0.0.1:3107${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  const json = await response.json().catch(() => ({}))
  return { ok: response.ok, status: response.status, json }
}

async function patch(path, body) {
  const response = await fetch(`http://127.0.0.1:3107${path}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  const json = await response.json().catch(() => ({}))
  return { ok: response.ok, status: response.status, json }
}

async function get(path) {
  const response = await fetch(`http://127.0.0.1:3107${path}`)
  return { ok: response.ok, status: response.status, json: await response.json().catch(() => ({})) }
}

try {
  // --- 1. Guidance data is deterministic and covers every emergency category ---
  const categories = ['Accident', 'Cardiac emergency', 'Burns', 'Unconscious Person', 'Other']
  for (const category of categories) {
    const entry = firstAidGuidance[category]
    assert.ok(entry, `guidance exists for ${category}`)
    const effective = getFirstAidGuidance(category)
    assert.strictEqual(effective, entry, `${category} resolves to its own guidance (no Other fallback)`)
    assert.ok(Array.isArray(effective.steps) && effective.steps.length >= 3, `${category} has ordered steps`)
    assert.ok(effective.steps.some((step) => step.includes('108')), `${category} tells the bystander to call 108`)
    assert.ok(effective.steps.every((step) => step.length <= 140), `${category} steps are short enough to read quickly`)
    assert.ok(Array.isArray(effective.donts) && effective.donts.length > 0, `${category} includes Do NOT actions`)
  }
  // 'Burn' wording resolves to the burn guidance deterministically.
  assert.strictEqual(getFirstAidGuidance('Burn'), firstAidGuidance.Burns)
  assert.strictEqual(getFirstAidGuidance('Unknown type'), firstAidGuidance.Other, 'unknown types fall back to Other')
  assert.strictEqual(getFirstAidGuidance('Unknown type'), getFirstAidGuidance('Also unknown'), 'lookup is deterministic')
  // Safety message mentions temporary help, contacting EMS, and not replacing a doctor/ambulance.
  assert.match(FIRST_AID_SAFETY_MESSAGE, /emergency medical services/)
  assert.match(FIRST_AID_SAFETY_MESSAGE, /does not replace a doctor or an ambulance/)

  // --- 2. Server-side: every category can be reported and the flow still works ---
  await waitForServer()
  const db = new Database(databasePath)
  const now = new Date().toISOString()
  const responderId = Number(db.prepare("INSERT INTO users (name, role, verified, available, latitude, longitude, location_updated_at) VALUES ('Step7 Responder', 'Doctor', 1, 1, 12.9716, 77.6006, ?)").run(now).lastInsertRowid)

  const createdIds = {}
  for (const category of categories) {
    const result = await post('/api/emergencies', {
      emergency_type: category, latitude: 12.9716, longitude: 77.5946,
    })
    assert.equal(result.ok, true, `POST accepts ${category}`)
    assert.equal(result.json.emergency.emergency_type, category, `${category} is stored as reported`)
    assert.equal(result.json.emergency.status, 'Searching for nearby responders')
    assert.ok(result.json.matched_responder_count >= 1, `${category} matched the nearby responder`)
    createdIds[category] = result.json.emergency.id
  }

  // An unknown type is still rejected.
  const unknown = await post('/api/emergencies', { emergency_type: 'Fake type', latitude: 12.97, longitude: 77.59 })
  assert.equal(unknown.status, 400)

  // Existing accept flow: primary responder selection, no radius expansion after accept.
  const accidentId = createdIds.Accident
  let accept = await patch(`/api/emergencies/${accidentId}/accept`, { responder_id: responderId })
  assert.equal(accept.ok, true)
  assert.equal(accept.json.emergency.assigned_responder_id, responderId, 'accepting responder becomes primary')
  assert.equal(accept.json.emergency.status, 'Primary responder selected')
  assert.equal(accept.json.emergency.accepted_count, 1)
  assert.equal(accept.json.emergency.search_radius_km, 1, 'acceptance prevents radius expansion')

  // Existing ambulance arrival flow is untouched.
  let arrival = await patch(`/api/emergencies/${accidentId}/ambulance-status`, { ambulance_arrived: true })
  assert.equal(arrival.ok, true)
  assert.equal(arrival.json.emergency.ambulance_arrival_status, 'arrived')
  assert.equal(arrival.json.emergency.status, 'Primary responder selected', 'ambulance status does not change response status')

  // Real-time = GET still returns everything after an accept/refresh.
  const refreshed = await get(`/api/emergencies/${accidentId}`)
  assert.equal(refreshed.ok, true)
  assert.equal(refreshed.json.emergency.assigned_responder_id, responderId)
  assert.equal(refreshed.json.emergency.ambulance_arrival_status, 'arrived')

  // Every other category remains active and visible to the responder.
  for (const category of categories) {
    if (category === 'Accident') continue
    const item = await get(`/api/emergencies/${createdIds[category]}`)
    assert.equal(item.ok, true, `${category} emergency still reachable`)
    assert.equal(item.json.emergency.emergency_type, category)
  }
  db.close()

  console.log('Step 7 verification passed: all 5 categories + Burn alias resolve, every category reports correctly, and accept/ambulance/radius flow still works.')
} finally {
  server.kill()
  await new Promise((resolve) => server.once('exit', resolve))
  for (const candidate of [databasePath, `${databasePath}-shm`, `${databasePath}-wal`]) {
    if (existsSync(candidate)) unlinkSync(candidate)
  }
}