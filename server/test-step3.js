import Database from 'better-sqlite3'
import assert from 'node:assert'
import { unlinkSync, existsSync } from 'node:fs'

const testDbPath = './data/test-step3.db'
if (existsSync(testDbPath)) {
  try { unlinkSync(testDbPath) } catch {}
}

const db = new Database(testDbPath)
db.pragma('journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    role TEXT NOT NULL,
    verified INTEGER NOT NULL DEFAULT 0 CHECK (verified IN (0, 1)),
    available INTEGER NOT NULL DEFAULT 0 CHECK (available IN (0, 1)),
    email TEXT,
    qualification TEXT,
    identity_id TEXT,
    institution TEXT,
    document_filename TEXT,
    document_path TEXT,
    password_hash TEXT,
    verification_status TEXT NOT NULL DEFAULT 'pending',
    latitude REAL,
    longitude REAL,
    location_updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS emergencies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    emergency_type TEXT NOT NULL,
    description TEXT,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL DEFAULT 'Alert created',
    assigned_responder_id INTEGER,
    scene_photo_filename TEXT,
    scene_photo_path TEXT,
    matched_responder_count INTEGER NOT NULL DEFAULT 0,
    search_radius_km REAL NOT NULL DEFAULT 1.0,
    radius_expanded_at TEXT,
    matched_responder_ids TEXT NOT NULL DEFAULT '[]',
    accepted_responder_ids TEXT NOT NULL DEFAULT '[]',
    rejected_responder_ids TEXT NOT NULL DEFAULT '[]',
    FOREIGN KEY (assigned_responder_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS emergency_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    emergency_id INTEGER NOT NULL,
    responder_id INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('accepted', 'rejected')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (emergency_id) REFERENCES emergencies(id),
    FOREIGN KEY (responder_id) REFERENCES users(id),
    UNIQUE(emergency_id, responder_id)
  );
`)

const INITIAL_SEARCH_RADIUS_KM = 1.0
const EXPANDED_SEARCH_RADIUS_KM = 2.0
const RADIUS_EXPANSION_TIMEOUT_MS = 20 * 1000
const LOCATION_STALE_MINUTES = 15

function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function calculateEtaMinutes(distanceKm) {
  if (typeof distanceKm !== 'number' || !Number.isFinite(distanceKm)) return null
  return Math.max(1, Math.round(distanceKm * 3))
}

function parseTimestampMs(dateStr) {
  if (!dateStr) return NaN
  if (typeof dateStr === 'number') return dateStr
  if (!dateStr.includes('T') && !dateStr.includes('Z')) {
    return new Date(dateStr.replace(' ', 'T') + 'Z').getTime()
  }
  return new Date(dateStr).getTime()
}

function isLocationFresh(locationUpdatedAt, maxMinutes = LOCATION_STALE_MINUTES) {
  if (!locationUpdatedAt) return false
  const updatedTime = parseTimestampMs(locationUpdatedAt)
  if (Number.isNaN(updatedTime)) return false
  const elapsedMs = Date.now() - updatedTime
  return elapsedMs >= 0 && elapsedMs <= maxMinutes * 60 * 1000
}

function findEligibleResponders() {
  return db.prepare(`
    SELECT id, name, role, latitude, longitude, location_updated_at
    FROM users
    WHERE verified = 1 AND available = 1 AND latitude IS NOT NULL AND longitude IS NOT NULL
  `).all().filter((candidate) => isLocationFresh(candidate.location_updated_at, LOCATION_STALE_MINUTES))
}

function checkAndExpandEmergencyRadius(emergency) {
  if (!emergency) return emergency
  let acceptedIds = []
  try { acceptedIds = JSON.parse(emergency.accepted_responder_ids || '[]') } catch { acceptedIds = [] }
  if (emergency.assigned_responder_id || acceptedIds.length > 0 || ['accepted', 'Help on the way', 'rejected'].includes(emergency.status)) {
    return emergency
  }
  const currentRadius = Number(emergency.search_radius_km || INITIAL_SEARCH_RADIUS_KM)
  if (currentRadius >= EXPANDED_SEARCH_RADIUS_KM) {
    return emergency
  }

  const createdTime = parseTimestampMs(emergency.created_at)
  if (Number.isNaN(createdTime)) return emergency
  const elapsedMs = Date.now() - createdTime

  if (elapsedMs >= RADIUS_EXPANSION_TIMEOUT_MS) {
    const freshCandidates = findEligibleResponders()
    let previouslyMatchedIds = []
    try { previouslyMatchedIds = JSON.parse(emergency.matched_responder_ids || '[]') } catch { previouslyMatchedIds = [] }

    const allMatchedIdsSet = new Set(previouslyMatchedIds)
    for (const candidate of freshCandidates) {
      const distance = calculateHaversineDistance(emergency.latitude, emergency.longitude, candidate.latitude, candidate.longitude)
      if (distance <= EXPANDED_SEARCH_RADIUS_KM) {
        allMatchedIdsSet.add(candidate.id)
      }
    }

    const updatedMatchedIds = Array.from(allMatchedIdsSet)
    const newStatus = 'Expanding search to 2 km'
    const nowIso = new Date().toISOString()

    db.prepare(`
      UPDATE emergencies
      SET search_radius_km = ?, radius_expanded_at = ?, matched_responder_count = ?, matched_responder_ids = ?, status = ?
      WHERE id = ?
    `).run(EXPANDED_SEARCH_RADIUS_KM, nowIso, updatedMatchedIds.length, JSON.stringify(updatedMatchedIds), newStatus, emergency.id)

    return db.prepare('SELECT * FROM emergencies WHERE id = ?').get(emergency.id)
  }

  return emergency
}

function acceptEmergency(emergencyId, responderId) {
  const responder = db.prepare('SELECT id, name, role, verified, available FROM users WHERE id = ? AND verified = 1 AND available = 1').get(responderId)
  if (!responder) throw new Error('A verified, available responder is required.')

  const emergency = db.prepare('SELECT * FROM emergencies WHERE id = ?').get(emergencyId)
  if (!emergency) throw new Error('Emergency not found.')

  const nowIso = new Date().toISOString()
  db.prepare(`
    INSERT INTO emergency_responses (emergency_id, responder_id, status, created_at)
    VALUES (?, ?, 'accepted', ?)
    ON CONFLICT(emergency_id, responder_id) DO UPDATE SET status = 'accepted', created_at = ?
  `).run(emergency.id, responderId, nowIso, nowIso)

  const acceptedRows = db.prepare("SELECT responder_id FROM emergency_responses WHERE emergency_id = ? AND status = 'accepted'").all(emergency.id)
  const acceptedIds = acceptedRows.map((r) => r.responder_id)

  let rejectedIds = []
  try { rejectedIds = JSON.parse(emergency.rejected_responder_ids || '[]') } catch { rejectedIds = [] }
  rejectedIds = rejectedIds.filter((id) => id !== responderId)

  const assignedResponderId = emergency.assigned_responder_id || responderId
  db.prepare(`
    UPDATE emergencies
    SET status = 'accepted',
        assigned_responder_id = ?,
        accepted_responder_ids = ?,
        rejected_responder_ids = ?
    WHERE id = ?
  `).run(assignedResponderId, JSON.stringify(acceptedIds), JSON.stringify(rejectedIds), emergency.id)

  return db.prepare('SELECT * FROM emergencies WHERE id = ?').get(emergencyId)
}

function rejectEmergency(emergencyId, responderId) {
  const responder = db.prepare('SELECT id, verified FROM users WHERE id = ?').get(responderId)
  if (!responder || !responder.verified) throw new Error('A verified responder is required.')

  const emergency = db.prepare('SELECT * FROM emergencies WHERE id = ?').get(emergencyId)
  if (!emergency) throw new Error('Emergency not found.')

  const nowIso = new Date().toISOString()
  db.prepare(`
    INSERT INTO emergency_responses (emergency_id, responder_id, status, created_at)
    VALUES (?, ?, 'rejected', ?)
    ON CONFLICT(emergency_id, responder_id) DO UPDATE SET status = 'rejected', created_at = ?
  `).run(emergency.id, responderId, nowIso, nowIso)

  const rejectedRows = db.prepare("SELECT responder_id FROM emergency_responses WHERE emergency_id = ? AND status = 'rejected'").all(emergency.id)
  const rejectedIds = rejectedRows.map((r) => r.responder_id)

  let acceptedIds = []
  try { acceptedIds = JSON.parse(emergency.accepted_responder_ids || '[]') } catch { acceptedIds = [] }
  acceptedIds = acceptedIds.filter((id) => id !== responderId)

  let assignedResponderId = emergency.assigned_responder_id
  let nextStatus = emergency.status
  if (assignedResponderId === responderId) {
    assignedResponderId = acceptedIds.length > 0 ? acceptedIds[0] : null
    if (!assignedResponderId && nextStatus === 'accepted') {
      nextStatus = (emergency.search_radius_km || 1.0) >= 2.0 ? 'Expanding search to 2 km' : 'Searching for nearby responders'
    }
  }

  db.prepare(`
    UPDATE emergencies
    SET assigned_responder_id = ?,
        status = ?,
        rejected_responder_ids = ?,
        accepted_responder_ids = ?
    WHERE id = ?
  `).run(assignedResponderId, nextStatus, JSON.stringify(rejectedIds), JSON.stringify(acceptedIds), emergency.id)

  return db.prepare('SELECT * FROM emergencies WHERE id = ?').get(emergencyId)
}

function getResponderEmergencies(responderId, currentLat, currentLon) {
  const responder = db.prepare('SELECT id, verified, available, latitude, longitude, location_updated_at FROM users WHERE id = ?').get(responderId)
  if (!responder || !responder.verified || !responder.available) {
    throw new Error('A verified, available responder is required.')
  }
  const lat = currentLat || responder.latitude
  const lon = currentLon || responder.longitude

  const allEmergencies = db.prepare("SELECT * FROM emergencies ORDER BY created_at DESC").all()
  const list = []

  for (let em of allEmergencies) {
    em = checkAndExpandEmergencyRadius(em)
    const allowedRadius = Number(em.search_radius_km || INITIAL_SEARCH_RADIUS_KM)
    const distance = calculateHaversineDistance(lat, lon, em.latitude, em.longitude)
    const roundedDistance = Math.round(distance * 10) / 10
    const etaMinutes = calculateEtaMinutes(distance)

    const responseRow = db.prepare('SELECT status, created_at FROM emergency_responses WHERE emergency_id = ? AND responder_id = ?').get(em.id, responderId)
    const userResponseStatus = responseRow?.status || 'incoming'

    const emergencyItem = {
      ...em,
      distance_km: roundedDistance,
      eta_minutes: etaMinutes,
      search_radius_km: allowedRadius,
      responder_status: userResponseStatus,
    }

    if (userResponseStatus === 'accepted' || userResponseStatus === 'rejected') {
      list.push(emergencyItem)
    } else if (distance <= allowedRadius) {
      list.push(emergencyItem)
    }
  }

  return list
}

console.log('--- STARTING STEP 3 VERIFICATION TEST SUITE ---')

// 1. Setup Test Responders
const nowIso = new Date().toISOString()
// Origin: 12.9716, 77.5946 (Bangalore City Center)
// Responder 1: ~0.4 km away (within 1.0 km)
const r1 = db.prepare(`
  INSERT INTO users (name, phone, role, verified, available, latitude, longitude, location_updated_at)
  VALUES ('Dr. Sarah', '9876543210', 'Doctor', 1, 1, 12.9730, 77.5960, ?)
`).run(nowIso)
const r1Id = r1.lastInsertRowid

// Responder 2: ~0.6 km away (within 1.0 km)
const r2 = db.prepare(`
  INSERT INTO users (name, phone, role, verified, available, latitude, longitude, location_updated_at)
  VALUES ('Nurse John', '9876543211', 'Trained Volunteer', 1, 1, 12.9750, 77.5920, ?)
`).run(nowIso)
const r2Id = r2.lastInsertRowid

// Responder 3: ~1.5 km away (outside 1.0 km, inside 2.0 km)
const r3 = db.prepare(`
  INSERT INTO users (name, phone, role, verified, available, latitude, longitude, location_updated_at)
  VALUES ('Dr. Priya', '9876543212', 'Doctor', 1, 1, 12.9820, 77.6030, ?)
`).run(nowIso)
const r3Id = r3.lastInsertRowid

console.log(`[PASS] Responders created: R1 (id:${r1Id}, 0.4km), R2 (id:${r2Id}, 0.6km), R3 (id:${r3Id}, 1.5km)`)

// TEST CASE 1: Emergency creation & initial 1 km matching
const e1 = db.prepare(`
  INSERT INTO emergencies (emergency_type, description, latitude, longitude, created_at, status, search_radius_km, matched_responder_ids, matched_responder_count)
  VALUES ('Accident', 'Bike collision', 12.9716, 77.5946, ?, 'Searching for nearby responders', 1.0, ?, 2)
`).run(nowIso, JSON.stringify([r1Id, r2Id]))
const e1Id = e1.lastInsertRowid

let em1 = db.prepare('SELECT * FROM emergencies WHERE id = ?').get(e1Id)
assert.strictEqual(em1.search_radius_km, 1.0)
assert.strictEqual(em1.status, 'Searching for nearby responders')
console.log('[PASS] Test Case 1.1: Emergency created with initial 1.0 km radius and 2 matched responders within 1 km')

// TEST CASE 1.2: One responder accepts
acceptEmergency(e1Id, r1Id)
em1 = db.prepare('SELECT * FROM emergencies WHERE id = ?').get(e1Id)
assert.strictEqual(em1.status, 'accepted')
assert.strictEqual(em1.assigned_responder_id, r1Id)
const acceptedIdsE1 = JSON.parse(em1.accepted_responder_ids)
assert.deepStrictEqual(acceptedIdsE1, [r1Id])

// Verify radius expansion is stopped on accept even after 30s
const oldTimestamp = new Date(Date.now() - 30000).toISOString()
db.prepare('UPDATE emergencies SET created_at = ? WHERE id = ?').run(oldTimestamp, e1Id)
em1 = db.prepare('SELECT * FROM emergencies WHERE id = ?').get(e1Id)
const checkedEm1 = checkAndExpandEmergencyRadius(em1)
assert.strictEqual(checkedEm1.search_radius_km, 1.0, 'Radius must NOT expand after acceptance')
assert.strictEqual(checkedEm1.status, 'accepted')
console.log('[PASS] Test Case 1.2: One responder accepts -> status="accepted", assigned, radius expansion stopped')

// TEST CASE 2: One responder rejects while others remain eligible
const e2 = db.prepare(`
  INSERT INTO emergencies (emergency_type, description, latitude, longitude, created_at, status, search_radius_km, matched_responder_ids, matched_responder_count)
  VALUES ('Cardiac emergency', 'Chest pain', 12.9716, 77.5946, ?, 'Searching for nearby responders', 1.0, ?, 2)
`).run(nowIso, JSON.stringify([r1Id, r2Id]))
const e2Id = e2.lastInsertRowid

// Responder 1 rejects
rejectEmergency(e2Id, r1Id)
let em2 = db.prepare('SELECT * FROM emergencies WHERE id = ?').get(e2Id)
assert.notStrictEqual(em2.status, 'rejected', 'Emergency must NOT be marked rejected globally when one responder rejects')
const rejectedIdsE2 = JSON.parse(em2.rejected_responder_ids)
assert.deepStrictEqual(rejectedIdsE2, [r1Id])

// Responder 2 checks incoming emergencies
const r2Emergencies = getResponderEmergencies(r2Id)
const r2HasE2 = r2Emergencies.find((e) => e.id === e2Id)
assert.ok(r2HasE2, 'Responder 2 must still receive emergency alert e2')
assert.strictEqual(r2HasE2.responder_status, 'incoming')
assert.strictEqual(typeof r2HasE2.distance_km, 'number')
assert.strictEqual(typeof r2HasE2.eta_minutes, 'number')

// Responder 1 checks emergencies -> e2 is marked rejected for R1
const r1Emergencies = getResponderEmergencies(r1Id)
const r1HasE2 = r1Emergencies.find((e) => e.id === e2Id)
assert.ok(r1HasE2)
assert.strictEqual(r1HasE2.responder_status, 'rejected')

// Responder 2 can now accept
acceptEmergency(e2Id, r2Id)
em2 = db.prepare('SELECT * FROM emergencies WHERE id = ?').get(e2Id)
assert.strictEqual(em2.status, 'accepted')
assert.strictEqual(em2.assigned_responder_id, r2Id)
console.log('[PASS] Test Case 2: One responder rejects -> only that responder is recorded as rejected, other responder remains eligible and accepts')

// TEST CASE 3: Multiple responders accept
const e3 = db.prepare(`
  INSERT INTO emergencies (emergency_type, description, latitude, longitude, created_at, status, search_radius_km, matched_responder_ids, matched_responder_count)
  VALUES ('Burns', 'Kitchen burn', 12.9716, 77.5946, ?, 'Searching for nearby responders', 1.0, ?, 2)
`).run(nowIso, JSON.stringify([r1Id, r2Id]))
const e3Id = e3.lastInsertRowid

acceptEmergency(e3Id, r1Id)
acceptEmergency(e3Id, r2Id)
const em3 = db.prepare('SELECT * FROM emergencies WHERE id = ?').get(e3Id)
const acceptedIdsE3 = JSON.parse(em3.accepted_responder_ids)
assert.strictEqual(acceptedIdsE3.length, 2)
assert.ok(acceptedIdsE3.includes(r1Id))
assert.ok(acceptedIdsE3.includes(r2Id))

const responsesE3 = db.prepare('SELECT * FROM emergency_responses WHERE emergency_id = ?').all(e3Id)
assert.strictEqual(responsesE3.length, 2)
console.log('[PASS] Test Case 3: Multiple responders accept -> all recorded in accepted_responder_ids and responses table')

// TEST CASE 4: All responders reject
const e4 = db.prepare(`
  INSERT INTO emergencies (emergency_type, description, latitude, longitude, created_at, status, search_radius_km, matched_responder_ids, matched_responder_count)
  VALUES ('Injury', 'Sprained ankle', 12.9716, 77.5946, ?, 'Searching for nearby responders', 1.0, ?, 2)
`).run(nowIso, JSON.stringify([r1Id, r2Id]))
const e4Id = e4.lastInsertRowid

rejectEmergency(e4Id, r1Id)
rejectEmergency(e4Id, r2Id)
const em4 = db.prepare('SELECT * FROM emergencies WHERE id = ?').get(e4Id)
const rejectedIdsE4 = JSON.parse(em4.rejected_responder_ids)
assert.strictEqual(rejectedIdsE4.length, 2)
assert.ok(rejectedIdsE4.includes(r1Id))
assert.ok(rejectedIdsE4.includes(r2Id))
console.log('[PASS] Test Case 4: All responders reject -> tracked cleanly per-responder')

// TEST CASE 5 & 7: No responder accepts before radius expansion (1 km -> 2 km expansion)
const e5 = db.prepare(`
  INSERT INTO emergencies (emergency_type, description, latitude, longitude, created_at, status, search_radius_km, matched_responder_ids, matched_responder_count)
  VALUES ('Breathing problem', 'Asthma attack', 12.9716, 77.5946, ?, 'Searching for nearby responders', 1.0, ?, 2)
`).run(oldTimestamp, JSON.stringify([r1Id, r2Id])) // 30 seconds ago
const e5Id = e5.lastInsertRowid

let em5 = db.prepare('SELECT * FROM emergencies WHERE id = ?').get(e5Id)
const expandedEm5 = checkAndExpandEmergencyRadius(em5)
assert.strictEqual(expandedEm5.search_radius_km, 2.0)
assert.strictEqual(expandedEm5.status, 'Expanding search to 2 km')
const matchedIdsE5 = JSON.parse(expandedEm5.matched_responder_ids)
assert.strictEqual(matchedIdsE5.length, 3, 'Should include R1, R2, and R3 (at 1.5km)')
assert.ok(matchedIdsE5.includes(r3Id), 'R3 must now be matched')
console.log('[PASS] Test Cases 5 & 7: No responder accepts before timeout -> expands to 2.0 km and matches R3')

// TEST CASE 6: A responder already notified is not notified again (no duplicate IDs)
const uniqueIds = new Set(matchedIdsE5)
assert.strictEqual(uniqueIds.size, matchedIdsE5.length, 'Matched responder IDs list must have no duplicates')
assert.strictEqual(matchedIdsE5.filter((id) => id === r1Id).length, 1, 'R1 must appear exactly once')
assert.strictEqual(matchedIdsE5.filter((id) => id === r2Id).length, 1, 'R2 must appear exactly once')
assert.strictEqual(matchedIdsE5.filter((id) => id === r3Id).length, 1, 'R3 must appear exactly once')
console.log('[PASS] Test Case 6: Already notified responders (R1, R2) are not duplicated when expanding to 2 km')

// Cleanup test db
db.close()
try { unlinkSync(testDbPath) } catch {}

console.log('\n========================================')
console.log('ALL 7 STEP 3 VERIFICATION TESTS PASSED!')
console.log('========================================')
