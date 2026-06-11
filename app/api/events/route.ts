import { NextResponse } from 'next/server'
import db from '@/lib/db'
import type { EventRow } from '@/types'

export async function GET() {
  try {
    const stmt = db.prepare('SELECT * FROM events ORDER BY created_at DESC LIMIT 50')
    const events = stmt.all() as EventRow[]
    return NextResponse.json(events)
  } catch (err) {
    console.error('Failed to get events:', err)
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    const stmt = db.prepare(`
      INSERT INTO events (created_at, event_type, person_count, car_count, servo_state, confidence_person, confidence_car)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    
    const info = stmt.run(
      body.created_at || new Date().toISOString(),
      body.event_type,
      body.person_count,
      body.car_count,
      body.servo_state,
      body.confidence_person,
      body.confidence_car
    )
    
    return NextResponse.json({ id: info.lastInsertRowid, success: true })
  } catch (err) {
    console.error('Failed to insert event:', err)
    return NextResponse.json({ error: 'Failed to insert event' }, { status: 500 })
  }
}
