import express from 'express'
import dotenv from 'dotenv'
import database from './db.js'

dotenv.config()

const app = express()
const port = Number(process.env.PORT || 3001)
const emergencyTypes = new Set(['Accident', 'Cardiac emergency', 'Breathing problem', 'Injury', 'Bleeding', 'Burns', 'Other'])
const statuses = new Set(['Alert created', 'Searching for nearby responders', 'Responder found', 'Help on the way'])

app.use(express.json({ limit: '10kb' }))

function validCoordinate(value, minimum, maximum) {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum
}

app.post('/api/emergencies', (request, response) => {
  const { emergency_type: emergencyType, description = '', latitude, longitude } = request.body || {}
  if (!emergencyTypes.has(emergencyType)) return response.status(400).json({ error: 'A valid emergency type is required.' })
  if (!validCoordinate(latitude, -90, 90) || !validCoordinate(longitude, -180, 180)) return response.status(400).json({ error: 'Valid latitude and longitude are required.' })
  if (typeof description !== 'string' || description.length > 240) return response.status(400).json({ error: 'Description must be 240 characters or fewer.' })

  const result = database.prepare('INSERT INTO emergencies (emergency_type, description, latitude, longitude) VALUES (?, ?, ?, ?)').run(emergencyType, description.trim(), latitude, longitude)
  const emergency = database.prepare('SELECT * FROM emergencies WHERE id = ?').get(result.lastInsertRowid)
  return response.status(201).json({ emergency })
})

app.get('/api/emergencies', (_request, response) => {
  const emergencies = database.prepare("SELECT * FROM emergencies WHERE status != 'Help on the way' ORDER BY created_at DESC").all()
  return response.json({ emergencies })
})

app.get('/api/emergencies/:id', (request, response) => {
  const emergency = database.prepare('SELECT * FROM emergencies WHERE id = ?').get(request.params.id)
  if (!emergency) return response.status(404).json({ error: 'Emergency not found.' })
  return response.json({ emergency })
})

app.patch('/api/emergencies/:id/status', (request, response) => {
  const { status } = request.body || {}
  if (!statuses.has(status)) return response.status(400).json({ error: 'A valid status is required.' })
  const result = database.prepare('UPDATE emergencies SET status = ? WHERE id = ?').run(status, request.params.id)
  if (!result.changes) return response.status(404).json({ error: 'Emergency not found.' })
  const emergency = database.prepare('SELECT * FROM emergencies WHERE id = ?').get(request.params.id)
  return response.json({ emergency })
})

app.use((_error, _request, response, _next) => response.status(400).json({ error: 'Invalid request.' }))
app.listen(port, () => console.log(`Emergency API listening on http://localhost:${port}`))