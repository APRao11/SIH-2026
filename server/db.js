import Database from 'better-sqlite3'
import dotenv from 'dotenv'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

dotenv.config()

const databasePath = process.env.DATABASE_PATH || './data/emergency-response.db'
mkdirSync(dirname(databasePath), { recursive: true })
const database = new Database(databasePath)
database.pragma('journal_mode = WAL')

database.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    role TEXT NOT NULL,
    verified INTEGER NOT NULL DEFAULT 0 CHECK (verified IN (0, 1)),
    available INTEGER NOT NULL DEFAULT 0 CHECK (available IN (0, 1))
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
    FOREIGN KEY (assigned_responder_id) REFERENCES users(id)
  );
`)

const userColumns = database.prepare('PRAGMA table_info(users)').all().map(({ name }) => name)
const responderColumns = [
  ['email', 'TEXT'],
  ['qualification', 'TEXT'],
  ['identity_id', 'TEXT'],
  ['institution', 'TEXT'],
  ['document_filename', 'TEXT'],
  ['document_path', 'TEXT'],
  ['password_hash', 'TEXT'],
  ['verification_status', "TEXT NOT NULL DEFAULT 'pending'"],
  ['latitude', 'REAL'],
  ['longitude', 'REAL'],
  ['location_updated_at', 'TEXT'],
]
for (const [name, definition] of responderColumns) {
  if (!userColumns.includes(name)) database.exec(`ALTER TABLE users ADD COLUMN ${name} ${definition}`)
}

const emergencyColumns = database.prepare('PRAGMA table_info(emergencies)').all().map(({ name }) => name)
const scenePhotoColumns = [
  ['scene_photo_filename', 'TEXT'],
  ['scene_photo_path', 'TEXT'],
  ['matched_responder_count', 'INTEGER NOT NULL DEFAULT 0'],
  ['search_radius_km', 'REAL NOT NULL DEFAULT 1.0'],
  ['radius_expanded_at', 'TEXT'],
  ['matched_responder_ids', "TEXT NOT NULL DEFAULT '[]'"],
]
for (const [name, definition] of scenePhotoColumns) {
  if (!emergencyColumns.includes(name)) database.exec(`ALTER TABLE emergencies ADD COLUMN ${name} ${definition}`)
}

export default database

