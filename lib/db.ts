import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

// Ensure data directory exists
const dataDir = path.join(process.cwd(), 'data')
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir)
}

const db = new Database(path.join(dataDir, 'smart-crosswalk.db'))

db.pragma('journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    event_type TEXT NOT NULL,
    person_count INTEGER NOT NULL,
    car_count INTEGER NOT NULL,
    servo_state TEXT NOT NULL,
    confidence_person REAL NOT NULL,
    confidence_car REAL NOT NULL
  )
`)

export default db
