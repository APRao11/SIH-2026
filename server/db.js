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

export default database