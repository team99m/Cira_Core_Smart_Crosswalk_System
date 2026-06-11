import { NextResponse } from 'next/server'
import db from '@/lib/db'
import type { StatRow } from '@/types'

export async function GET() {
  try {
    const stmt = db.prepare(`
      SELECT 
        strftime('%H', created_at) as hour,
        COUNT(*) as total_events,
        SUM(CASE WHEN event_type = 'BARRIER_ACTIVATED' THEN 1 ELSE 0 END) as activations
      FROM events
      WHERE date(created_at) = date('now', 'localtime')
      GROUP BY hour
    `)
    
    const rows = stmt.all() as any[]
    
    const stats: StatRow[] = Array.from({ length: 24 }).map((_, i) => {
      const hr = i.toString().padStart(2, '0')
      const row = rows.find(r => r.hour === hr)
      return {
        hour: hr,
        total_events: row ? row.total_events : 0,
        activations: row ? row.activations : 0,
      }
    })
    
    return NextResponse.json(stats)
  } catch (err) {
    console.error('Failed to get stats:', err)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
