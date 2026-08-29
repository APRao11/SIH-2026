import express from 'express'
import dotenv from 'dotenv'
import database from './db.js'
import multer from 'multer'
import { mkdirSync, writeFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { randomUUID, scryptSync } from 'node:crypto'

dotenv.config()

const app = express()
const port = Number(process.env.PORT || 3001)
const emergencyTypes = new Set(['Accident', 'Cardiac emergency', 'Breathing problem', 'Injury', 'Bleeding', 'Burns', 'Other'])
const statuses = new Set(['Alert created', 'Searching for nearby responders', 'Responder found', 'Help on the way'])
const responderStatuses = new Set(['accepted', 'rejected'])
const roles = new Set(['Doctor', 'Medical Student', 'Trained Volunteer'])
const uploadDirectory = process.env.UPLOAD_DIR || './data/uploads'
const scenePhotoDirectory = join(uploadDirectory, 'emergency-scenes')
mkdirSync(uploadDirectory, { recursive: true })
mkdirSync(scenePhotoDirectory, { recursive: true })
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
  const responder = database.prepare('SELECT id, name, role, qualification, verified, available, verification_status, document_filename FROM users WHERE id = ?').get(result.lastInsertRowid)
  return response.status(201).json({ responder })
})

app.get('/api/responders', (_request, response) => response.json({ responders: database.prepare("SELECT id, name, role, qualification, verified, available, verification_status, document_filename FROM users WHERE role IN ('Doctor', 'Medical Student', 'Trained Volunteer') ORDER BY id DESC").all() }))

app.patch('/api/responders/:id/verification', (request, response) => {
  const { decision } = request.body || {}
  if (!['verify', 'reject'].includes(decision)) return response.status(400).json({ error: 'Decision must be verify or reject.' })
  const result = database.prepare("UPDATE users SET verified = ?, verification_status = ?, available = 0 WHERE id = ? AND verification_status = 'pending'").run(decision === 'verify' ? 1 : 0, decision === 'verify' ? 'verified' : 'rejected', request.params.id)
  if (!result.changes) {
    const responder = database.prepare('SELECT id FROM users WHERE id = ?').get(request.params.id)
    return response.status(responder ? 409 : 404).json({ error: responder ? 'This responder has already been reviewed.' : 'Responder not found.' })
  }
  return response.json({ responder: database.prepare('SELECT id, name, role, qualification, verified, available, verification_status, document_filename FROM users WHERE id = ?').get(request.params.id) })
})

app.get('/api/responders/:id/document', (request, response) => {
  const responder = database.prepare('SELECT document_path, document_filename FROM users WHERE id = ?').get(request.params.id)
  if (!responder?.document_path) return response.status(404).json({ error: 'Document not found.' })
  return response.download(responder.document_path, responder.document_filename)
})

app.patch('/api/responders/:id/availability', (request, response) => {
  const available = request.body?.available
  if (typeof available !== 'boolean') return response.status(400).json({ error: 'Availability must be a boolean.' })
  const result = database.prepare('UPDATE users SET available = ? WHERE id = ? AND verified = 1').run(available ? 1 : 0, request.params.id)
  if (!result.changes) return response.status(403).json({ error: 'Only a verified responder can change availability.' })
  return response.json({ responder: database.prepare('SELECT id, name, role, qualification, verified, available, verification_status FROM users WHERE id = ?').get(request.params.id) })
})

function validCoordinate(value, minimum, maximum) {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum
}

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
  const result = database.prepare('INSERT INTO emergencies (emergency_type, description, latitude, longitude, scene_photo_filename, scene_photo_path) VALUES (?, ?, ?, ?, ?, ?)').run(emergencyType, description.trim(), latitude, longitude, photo?.filename || null, photo?.path || null)
  const emergency = database.prepare('SELECT * FROM emergencies WHERE id = ?').get(result.lastInsertRowid)
  return response.status(201).json({ emergency })
})

app.get('/api/emergencies/:id/photo', (request, response) => {
  const responderId = Number(request.query.responder_id)
  const responder = database.prepare('SELECT id FROM users WHERE id = ? AND verified = 1 AND available = 1').get(responderId)
  if (!responder) return response.status(403).json({ error: 'A verified, available responder is required.' })
  const emergency = database.prepare('SELECT scene_photo_path, scene_photo_filename FROM emergencies WHERE id = ?').get(request.params.id)
  if (!emergency?.scene_photo_path) return response.status(404).json({ error: 'Scene photo not found.' })
  return response.sendFile(emergency.scene_photo_path, { headers: { 'Content-Disposition': `inline; filename="${emergency.scene_photo_filename}"` } })
})

app.get('/api/emergencies', (_request, response) => {
  const emergencies = database.prepare("SELECT * FROM emergencies WHERE status NOT IN ('Help on the way', 'rejected') ORDER BY created_at DESC").all()
  return response.json({ emergencies })
})

app.get('/api/emergencies/:id', (request, response) => {
  const emergency = database.prepare("SELECT e.*, CASE WHEN e.assigned_responder_id IS NOT NULL THEN u.name END AS responder_name, CASE WHEN e.assigned_responder_id IS NOT NULL THEN u.role END AS responder_role FROM emergencies e LEFT JOIN users u ON u.id = e.assigned_responder_id WHERE e.id = ?").get(request.params.id)
  if (!emergency) return response.status(404).json({ error: 'Emergency not found.' })
  return response.json({ emergency })
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
  const responder = database.prepare('SELECT id FROM users WHERE id = ? AND verified = 1 AND available = 1').get(responderId)
  if (!responder) return response.status(403).json({ error: 'A verified, available responder is required.' })
  const latitude = Number(request.query.latitude)
  const longitude = Number(request.query.longitude)
  const emergencies = database.prepare("SELECT * FROM emergencies WHERE status NOT IN ('Help on the way', 'accepted', 'rejected') ORDER BY created_at DESC").all().map((emergency) => ({ ...emergency, distance_km: validCoordinate(latitude, -90, 90) && validCoordinate(longitude, -180, 180) ? Math.round(Math.sqrt(((emergency.latitude - latitude) * 111) ** 2 + ((emergency.longitude - longitude) * 111 * Math.cos(latitude * Math.PI / 180)) ** 2) * 10) / 10 : null }))
  return response.json({ emergencies })
})

app.patch('/api/emergencies/:id/accept', (request, response) => {
  const responderId = Number(request.body?.responder_id)
  const responder = database.prepare('SELECT id FROM users WHERE id = ? AND verified = 1 AND available = 1').get(responderId)
  if (!responder) return response.status(403).json({ error: 'A verified, available responder is required.' })
  const result = database.prepare("UPDATE emergencies SET assigned_responder_id = ?, status = 'accepted' WHERE id = ? AND status NOT IN ('accepted', 'Help on the way')").run(responderId, request.params.id)
  if (!result.changes) return response.status(409).json({ error: 'Emergency is no longer available.' })
  return response.json({ emergency: database.prepare('SELECT * FROM emergencies WHERE id = ?').get(request.params.id) })
})

app.patch('/api/emergencies/:id/reject', (request, response) => {
  const result = database.prepare("UPDATE emergencies SET status = 'rejected' WHERE id = ? AND status NOT IN ('accepted', 'Help on the way')").run(request.params.id)
  if (!result.changes) return response.status(409).json({ error: 'Emergency is no longer available.' })
  return response.json({ emergency: database.prepare('SELECT * FROM emergencies WHERE id = ?').get(request.params.id) })
})

app.use((error, _request, response, _next) => {
  console.error(error)
  if (error?.type === 'entity.too.large') {
    return response.status(413).json({ error: 'The photo is too large. Please upload a smaller image.' })
  }
  return response.status(400).json({ error: error?.message || 'Invalid request.' })
})
app.listen(port, () => console.log(`Emergency API listening on http://localhost:${port}`))
