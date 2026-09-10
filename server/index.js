import express from 'express'
import dotenv from 'dotenv'
import database from './db.js'
import multer from 'multer'
import { mkdirSync, writeFileSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import { randomUUID, scryptSync } from 'node:crypto'

dotenv.config()

const app = express()
const port = Number(process.env.PORT || 3001)
const emergencyTypes = new Set(['Accident', 'Cardiac emergency', 'Breathing problem', 'Injury', 'Bleeding', 'Burns', 'Other'])
const statuses = new Set(['Alert created', 'Searching for nearby responders', 'Expanding search to 2 km', 'Responder found', 'Help on the way', 'accepted', 'rejected'])
const responderStatuses = new Set(['accepted', 'rejected'])
const roles = new Set(['Doctor', 'Medical Student', 'Trained Volunteer'])
const uploadDirectory = process.env.UPLOAD_DIR || './data/uploads'
const scenePhotoDirectory = join(uploadDirectory, 'emergency-scenes')
mkdirSync(uploadDirectory, { recursive: true })
mkdirSync(scenePhotoDirectory, { recursive: true })

const INITIAL_SEARCH_RADIUS_KM = 1.0
const EXPANDED_SEARCH_RADIUS_KM = 2.0
const RADIUS_EXPANSION_TIMEOUT_MS = 20 * 1000 // 20 seconds for responsive prototype verification
const LOCATION_STALE_MINUTES = 15

function validCoordinate(value, minimum, maximum) {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum
}

function calculateEtaMinutes(distanceKm) {
  if (typeof distanceKm !== 'number' || !Number.isFinite(distanceKm)) return null
  // Average urban responder transit speed (~20 km/h = 3 min/km) with a minimum of 1 minute
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

function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371 // Earth radius in kilometers
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

function isLocationFresh(locationUpdatedAt, maxMinutes = LOCATION_STALE_MINUTES) {
  if (!locationUpdatedAt) return false
  const updatedTime = parseTimestampMs(locationUpdatedAt)
  if (Number.isNaN(updatedTime)) return false
  const elapsedMs = Date.now() - updatedTime
  return elapsedMs >= 0 && elapsedMs <= maxMinutes * 60 * 1000
}

function findEligibleResponders() {
  return database.prepare(`
    SELECT id, name, role, latitude, longitude, location_updated_at
    FROM users
    WHERE verified = 1 AND available = 1 AND latitude IS NOT NULL AND longitude IS NOT NULL
  `).all().filter((candidate) => isLocationFresh(candidate.location_updated_at, LOCATION_STALE_MINUTES))
}

function checkAndExpandEmergencyRadius(emergency) {
  if (!emergency) return emergency
  let acceptedIds = []
  try {
    acceptedIds = JSON.parse(emergency.accepted_responder_ids || '[]')
  } catch {
    acceptedIds = []
  }
  // Stop expansion if responder assigned, any responder accepted, or emergency is closed/resolved
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
    try {
      previouslyMatchedIds = JSON.parse(emergency.matched_responder_ids || '[]')
    } catch {
      previouslyMatchedIds = []
    }

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

    database.prepare(`
      UPDATE emergencies
      SET search_radius_km = ?, radius_expanded_at = ?, matched_responder_count = ?, matched_responder_ids = ?, status = ?
      WHERE id = ?
    `).run(EXPANDED_SEARCH_RADIUS_KM, nowIso, updatedMatchedIds.length, JSON.stringify(updatedMatchedIds), newStatus, emergency.id)

    return database.prepare(`
      SELECT e.*, 
        CASE WHEN e.assigned_responder_id IS NOT NULL THEN u.name END AS responder_name, 
        CASE WHEN e.assigned_responder_id IS NOT NULL THEN u.role END AS responder_role 
      FROM emergencies e 
      LEFT JOIN users u ON u.id = e.assigned_responder_id 
      WHERE e.id = ?
    `).get(emergency.id)
  }

  return emergency
}

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDirectory,
    filename: (_request, file, callback) => callback(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`),
  }),
  fileFilter: (_request, file, callback) => callback(null, ['application/pdf', 'image/jpeg', 'image/png'].includes(file.mimetype)),
  limits: { fileSize: 5 * 1024 * 1024 },
})

app.use(express.json({ limit: '20mb' }))

app.post('/api/responders', upload.single('verificationDocument'), (request, response) => {
  const { name, phone, email, role, qualification, identity_id: identityId, institution, password } = request.body || {}
  if (!name?.trim() || !phone?.trim() || !email?.trim() || !roles.has(role) || !qualification?.trim() || !identityId?.trim() || !institution?.trim() || !password || !request.file) return response.status(400).json({ error: 'All registration fields and a verification document are required.' })
  if (password.length < 8) return response.status(400).json({ error: 'Password must be at least 8 characters.' })
  const passwordHash = scryptSync(password, process.env.PASSWORD_SALT || 'mvp-development-salt', 32).toString('hex')
  const result = database.prepare('INSERT INTO users (name, phone, email, role, qualification, identity_id, institution, document_filename, document_path, password_hash, verified, available, verification_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)').run(name.trim(), phone.trim(), email.trim().toLowerCase(), role, qualification.trim(), identityId.trim(), institution.trim(), request.file.originalname, request.file.path, passwordHash, 'pending')
  const responder = database.prepare('SELECT id, name, role, qualification, verified, available, verification_status, document_filename, latitude, longitude, location_updated_at FROM users WHERE id = ?').get(result.lastInsertRowid)
  return response.status(201).json({ responder })
})

app.get('/api/responders', (_request, response) => response.json({ responders: database.prepare("SELECT id, name, role, qualification, verified, available, verification_status, document_filename, latitude, longitude, location_updated_at FROM users WHERE role IN ('Doctor', 'Medical Student', 'Trained Volunteer') ORDER BY id DESC").all() }))

app.patch('/api/responders/:id/verification', (request, response) => {
  const { decision } = request.body || {}
  if (!['verify', 'reject'].includes(decision)) return response.status(400).json({ error: 'Decision must be verify or reject.' })
  const result = database.prepare("UPDATE users SET verified = ?, verification_status = ?, available = 0 WHERE id = ? AND verification_status = 'pending'").run(decision === 'verify' ? 1 : 0, decision === 'verify' ? 'verified' : 'rejected', request.params.id)
  if (!result.changes) {
    const responder = database.prepare('SELECT id FROM users WHERE id = ?').get(request.params.id)
    return response.status(responder ? 409 : 404).json({ error: responder ? 'This responder has already been reviewed.' : 'Responder not found.' })
  }
  return response.json({ responder: database.prepare('SELECT id, name, role, qualification, verified, available, verification_status, document_filename, latitude, longitude, location_updated_at FROM users WHERE id = ?').get(request.params.id) })
})

app.get('/api/responders/:id/document', (request, response) => {
  const responder = database.prepare('SELECT document_path, document_filename FROM users WHERE id = ?').get(request.params.id)
  if (!responder?.document_path) return response.status(404).json({ error: 'Document not found.' })
  return response.download(resolve(responder.document_path), responder.document_filename)
})

app.patch('/api/responders/:id/availability', (request, response) => {
  const available = request.body?.available
  if (typeof available !== 'boolean') return response.status(400).json({ error: 'Availability must be a boolean.' })
  const result = database.prepare('UPDATE users SET available = ? WHERE id = ? AND verified = 1').run(available ? 1 : 0, request.params.id)
  if (!result.changes) return response.status(403).json({ error: 'Only a verified responder can change availability.' })
  return response.json({ responder: database.prepare('SELECT id, name, role, qualification, verified, available, verification_status, latitude, longitude, location_updated_at FROM users WHERE id = ?').get(request.params.id) })
})

app.patch('/api/responders/:id/location', (request, response) => {
  const { latitude, longitude } = request.body || {}
  if (!validCoordinate(latitude, -90, 90) || !validCoordinate(longitude, -180, 180)) {
    return response.status(400).json({ error: 'Valid latitude and longitude are required.' })
  }
  const responder = database.prepare('SELECT id, verified FROM users WHERE id = ?').get(request.params.id)
  if (!responder) return response.status(404).json({ error: 'Responder not found.' })
  if (!responder.verified) return response.status(403).json({ error: 'Only a verified responder can update location.' })

  const now = new Date().toISOString()
  database.prepare('UPDATE users SET latitude = ?, longitude = ?, location_updated_at = ? WHERE id = ?').run(latitude, longitude, now, request.params.id)
  const updatedResponder = database.prepare('SELECT id, name, role, qualification, verified, available, verification_status, latitude, longitude, location_updated_at FROM users WHERE id = ?').get(request.params.id)
  return response.json({ responder: updatedResponder })
})

function saveScenePhoto(dataUrl) {
  if (!dataUrl) return null
  if (typeof dataUrl !== 'string') throw new Error('The scene photo must be an image.')
  const match = /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl)
  if (!match) throw new Error('The scene photo must be a JPEG or PNG image.')
  const data = Buffer.from(match[2], 'base64')
  if (!data.length || data.length > 5 * 1024 * 1024) throw new Error('The scene photo must be 5 MB or smaller.')
  const extension = match[1] === 'image/png' ? '.png' : '.jpg'
  const filename = `${randomUUID()}${extension}`
  const path = join(scenePhotoDirectory, filename)
  writeFileSync(path, data, { flag: 'wx' })
  return { filename, path }
}

app.post('/api/emergencies', (request, response) => {
  const { emergency_type: emergencyType, description = '', latitude, longitude, scene_photo: scenePhoto } = request.body || {}
  if (!emergencyTypes.has(emergencyType)) return response.status(400).json({ error: 'A valid emergency type is required.' })
  if (!validCoordinate(latitude, -90, 90) || !validCoordinate(longitude, -180, 180)) return response.status(400).json({ error: 'Valid latitude and longitude are required.' })
  if (typeof description !== 'string' || description.length > 240) return response.status(400).json({ error: 'Description must be 240 characters or fewer.' })

  let photo
  try { photo = saveScenePhoto(scenePhoto) } catch (error) { return response.status(400).json({ error: error.message }) }

  const candidates = findEligibleResponders()

  const matchedResponders = []
  const matchedIds = []
  for (const candidate of candidates) {
    const distance = calculateHaversineDistance(latitude, longitude, candidate.latitude, candidate.longitude)
    if (distance <= INITIAL_SEARCH_RADIUS_KM) {
      matchedResponders.push({
        id: candidate.id,
        name: candidate.name,
        role: candidate.role,
        distance_km: Math.round(distance * 100) / 100,
      })
      matchedIds.push(candidate.id)
    }
  }

  const initialStatus = 'Searching for nearby responders'
  const matchedCount = matchedResponders.length
  const nowIso = new Date().toISOString()

  const result = database.prepare(
    'INSERT INTO emergencies (emergency_type, description, latitude, longitude, created_at, status, scene_photo_filename, scene_photo_path, matched_responder_count, search_radius_km, matched_responder_ids) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(emergencyType, description.trim(), latitude, longitude, nowIso, initialStatus, photo?.filename || null, photo?.path || null, matchedCount, INITIAL_SEARCH_RADIUS_KM, JSON.stringify(matchedIds))

  const emergency = database.prepare('SELECT * FROM emergencies WHERE id = ?').get(result.lastInsertRowid)
  return response.status(201).json({
    emergency,
    matched_responder_count: matchedCount,
    matched_responders: matchedResponders,
  })
})

app.get('/api/emergencies/:id/photo', (request, response) => {
  const responderId = Number(request.query.responder_id)
  // Allow verified responders (available OR accepted) to view scene photos
  const responder = database.prepare('SELECT id FROM users WHERE id = ? AND verified = 1').get(responderId)
  if (!responder) return response.status(403).json({ error: 'A verified responder is required.' })
  const emergency = database.prepare('SELECT scene_photo_path, scene_photo_filename FROM emergencies WHERE id = ?').get(request.params.id)
  if (!emergency?.scene_photo_path) return response.status(404).json({ error: 'Scene photo not found.' })
  const absolutePath = resolve(emergency.scene_photo_path)
  return response.sendFile(absolutePath, { headers: { 'Content-Disposition': `inline; filename="${emergency.scene_photo_filename}"` } })
})

app.get('/api/emergencies', (_request, response) => {
  const emergencies = database.prepare("SELECT * FROM emergencies WHERE status NOT IN ('Help on the way', 'rejected') ORDER BY created_at DESC").all().map(checkAndExpandEmergencyRadius)
  return response.json({ emergencies })
})

app.get('/api/emergencies/:id', (request, response) => {
  let emergency = database.prepare(`
    SELECT e.*, 
      CASE WHEN e.assigned_responder_id IS NOT NULL THEN u.name END AS responder_name, 
      CASE WHEN e.assigned_responder_id IS NOT NULL THEN u.role END AS responder_role 
    FROM emergencies e 
    LEFT JOIN users u ON u.id = e.assigned_responder_id 
    WHERE e.id = ?
  `).get(request.params.id)
  if (!emergency) return response.status(404).json({ error: 'Emergency not found.' })
  emergency = checkAndExpandEmergencyRadius(emergency)

  const acceptedResponders = database.prepare(`
    SELECT u.id, u.name, u.role, u.qualification, er.created_at AS accepted_at
    FROM emergency_responses er
    JOIN users u ON u.id = er.responder_id
    WHERE er.emergency_id = ? AND er.status = 'accepted'
    ORDER BY er.created_at ASC
  `).all(emergency.id)

  return response.json({
    emergency: {
      ...emergency,
      accepted_responders: acceptedResponders,
      accepted_count: acceptedResponders.length,
    },
  })
})

app.patch('/api/emergencies/:id/status', (request, response) => {
  const { status } = request.body || {}
  if (!statuses.has(status) && !responderStatuses.has(status)) return response.status(400).json({ error: 'A valid status is required.' })
  const result = database.prepare('UPDATE emergencies SET status = ? WHERE id = ?').run(status, request.params.id)
  if (!result.changes) return response.status(404).json({ error: 'Emergency not found.' })
  const emergency = database.prepare('SELECT * FROM emergencies WHERE id = ?').get(request.params.id)
  return response.json({ emergency })
})

app.get('/api/responder/emergencies', (request, response) => {
  const responderId = Number(request.query.responder_id)
  const responder = database.prepare('SELECT id, verified, available, latitude, longitude, location_updated_at FROM users WHERE id = ?').get(responderId)
  if (!responder || !responder.verified || !responder.available) {
    return response.status(403).json({ error: 'A verified, available responder is required.' })
  }

  let lat = responder.latitude
  let lon = responder.longitude
  let locUpdatedAt = responder.location_updated_at

  const queryLat = Number(request.query.latitude)
  const queryLon = Number(request.query.longitude)
  if (validCoordinate(queryLat, -90, 90) && validCoordinate(queryLon, -180, 180)) {
    lat = queryLat
    lon = queryLon
    locUpdatedAt = new Date().toISOString()
    database.prepare('UPDATE users SET latitude = ?, longitude = ?, location_updated_at = ? WHERE id = ?').run(lat, lon, locUpdatedAt, responderId)
  }

  const hasValidCoord = validCoordinate(lat, -90, 90) && validCoordinate(lon, -180, 180)
  const isFresh = isLocationFresh(locUpdatedAt, LOCATION_STALE_MINUTES)

  if (!hasValidCoord || !isFresh) {
    return response.json({
      emergencies: [],
      location_status: !hasValidCoord ? 'missing' : 'stale',
      message: !hasValidCoord
        ? 'Location is required to find nearby emergencies.'
        : 'Location is stale (older than 15 minutes). Please update your location.',
    })
  }

  const allEmergencies = database.prepare("SELECT * FROM emergencies ORDER BY created_at DESC").all()

  const emergencies = []
  for (let em of allEmergencies) {
    em = checkAndExpandEmergencyRadius(em)
    const allowedRadius = Number(em.search_radius_km || INITIAL_SEARCH_RADIUS_KM)
    const distance = calculateHaversineDistance(lat, lon, em.latitude, em.longitude)
    const roundedDistance = Math.round(distance * 10) / 10
    const etaMinutes = calculateEtaMinutes(distance)

    const responseRow = database.prepare('SELECT status, created_at FROM emergency_responses WHERE emergency_id = ? AND responder_id = ?').get(em.id, responderId)
    const userResponseStatus = responseRow?.status || 'incoming'

    const acceptedResponders = database.prepare(`
      SELECT u.id, u.name, u.role, u.qualification, er.created_at AS accepted_at
      FROM emergency_responses er
      JOIN users u ON u.id = er.responder_id
      WHERE er.emergency_id = ? AND er.status = 'accepted'
      ORDER BY er.created_at ASC
    `).all(em.id)

    const emergencyItem = {
      ...em,
      distance_km: roundedDistance,
      eta_minutes: etaMinutes,
      search_radius_km: allowedRadius,
      search_stage: allowedRadius >= 2.0 ? 'Stage 2 (2.0 km expanded)' : 'Stage 1 (1.0 km initial)',
      responder_status: userResponseStatus,
      accepted_responders: acceptedResponders,
      accepted_count: acceptedResponders.length,
    }

    if (userResponseStatus === 'accepted' || userResponseStatus === 'rejected') {
      emergencies.push(emergencyItem)
    } else if (distance <= allowedRadius) {
      emergencies.push(emergencyItem)
    }
  }

  return response.json({ emergencies })
})

app.patch('/api/emergencies/:id/accept', (request, response) => {
  const responderId = Number(request.body?.responder_id)
  if (!responderId) return response.status(400).json({ error: 'Responder ID is required.' })

  const responder = database.prepare('SELECT id, name, role, verified, available FROM users WHERE id = ? AND verified = 1 AND available = 1').get(responderId)
  if (!responder) return response.status(403).json({ error: 'A verified, available responder is required.' })

  const emergency = database.prepare('SELECT * FROM emergencies WHERE id = ?').get(request.params.id)
  if (!emergency) return response.status(404).json({ error: 'Emergency not found.' })

  const nowIso = new Date().toISOString()
  database.prepare(`
    INSERT INTO emergency_responses (emergency_id, responder_id, status, created_at)
    VALUES (?, ?, 'accepted', ?)
    ON CONFLICT(emergency_id, responder_id) DO UPDATE SET status = 'accepted', created_at = ?
  `).run(emergency.id, responderId, nowIso, nowIso)

  const acceptedRows = database.prepare("SELECT responder_id FROM emergency_responses WHERE emergency_id = ? AND status = 'accepted'").all(emergency.id)
  const acceptedIds = acceptedRows.map((r) => r.responder_id)

  let rejectedIds = []
  try { rejectedIds = JSON.parse(emergency.rejected_responder_ids || '[]') } catch { rejectedIds = [] }
  rejectedIds = rejectedIds.filter((id) => id !== responderId)

  const assignedResponderId = emergency.assigned_responder_id || responderId
  database.prepare(`
    UPDATE emergencies
    SET status = 'accepted',
        assigned_responder_id = ?,
        accepted_responder_ids = ?,
        rejected_responder_ids = ?
    WHERE id = ?
  `).run(assignedResponderId, JSON.stringify(acceptedIds), JSON.stringify(rejectedIds), emergency.id)

  const updatedEmergency = database.prepare(`
    SELECT e.*, 
      CASE WHEN e.assigned_responder_id IS NOT NULL THEN u.name END AS responder_name, 
      CASE WHEN e.assigned_responder_id IS NOT NULL THEN u.role END AS responder_role 
    FROM emergencies e 
    LEFT JOIN users u ON u.id = e.assigned_responder_id 
    WHERE e.id = ?
  `).get(emergency.id)

  const acceptedResponders = database.prepare(`
    SELECT u.id, u.name, u.role, u.qualification, er.created_at AS accepted_at
    FROM emergency_responses er
    JOIN users u ON u.id = er.responder_id
    WHERE er.emergency_id = ? AND er.status = 'accepted'
    ORDER BY er.created_at ASC
  `).all(emergency.id)

  return response.json({
    emergency: { ...updatedEmergency, accepted_responders: acceptedResponders, accepted_count: acceptedResponders.length },
    accepted_responder_ids: acceptedIds,
    message: 'Emergency accepted successfully. You are now responding to this alert.',
  })
})

app.patch('/api/emergencies/:id/reject', (request, response) => {
  const responderId = Number(request.body?.responder_id || request.query.responder_id)
  if (!responderId) return response.status(400).json({ error: 'Responder ID is required.' })

  const responder = database.prepare('SELECT id, verified FROM users WHERE id = ?').get(responderId)
  if (!responder || !responder.verified) return response.status(403).json({ error: 'A verified responder is required.' })

  const emergency = database.prepare('SELECT * FROM emergencies WHERE id = ?').get(request.params.id)
  if (!emergency) return response.status(404).json({ error: 'Emergency not found.' })

  const nowIso = new Date().toISOString()
  database.prepare(`
    INSERT INTO emergency_responses (emergency_id, responder_id, status, created_at)
    VALUES (?, ?, 'rejected', ?)
    ON CONFLICT(emergency_id, responder_id) DO UPDATE SET status = 'rejected', created_at = ?
  `).run(emergency.id, responderId, nowIso, nowIso)

  const rejectedRows = database.prepare("SELECT responder_id FROM emergency_responses WHERE emergency_id = ? AND status = 'rejected'").all(emergency.id)
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

  database.prepare(`
    UPDATE emergencies
    SET assigned_responder_id = ?,
        status = ?,
        rejected_responder_ids = ?,
        accepted_responder_ids = ?
    WHERE id = ?
  `).run(assignedResponderId, nextStatus, JSON.stringify(rejectedIds), JSON.stringify(acceptedIds), emergency.id)

  const updatedEmergency = database.prepare(`
    SELECT e.*, 
      CASE WHEN e.assigned_responder_id IS NOT NULL THEN u.name END AS responder_name, 
      CASE WHEN e.assigned_responder_id IS NOT NULL THEN u.role END AS responder_role 
    FROM emergencies e 
    LEFT JOIN users u ON u.id = e.assigned_responder_id 
    WHERE e.id = ?
  `).get(emergency.id)

  return response.json({
    emergency: updatedEmergency,
    rejected_responder_ids: rejectedIds,
    message: 'Emergency declined for this responder.',
  })
})

app.use((error, _request, response, _next) => {
  console.error(error)
  if (error?.type === 'entity.too.large') {
    return response.status(413).json({ error: 'The photo is too large. Please upload a smaller image.' })
  }
  return response.status(400).json({ error: error?.message || 'Invalid request.' })
})

app.listen(port, () => console.log(`Emergency API listening on http://localhost:${port}`))
