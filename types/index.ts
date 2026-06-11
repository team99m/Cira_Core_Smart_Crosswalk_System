// ── Smart Crosswalk Type Definitions ──

export type ServoState = 'open' | 'closed'

export type EventType = 'BARRIER_ACTIVATED' | 'BARRIER_DEACTIVATED' | 'ALERT'

export type DetectionData = {
  timestamp: string
  person_count: number
  car_count: number
  person_confidence: number
  car_confidence: number
  servo_state: ServoState
}

export type EventRow = {
  id: number
  created_at: string
  event_type: EventType
  person_count: number
  car_count: number
  servo_state: ServoState
  confidence_person: number
  confidence_car: number
}

export type StatRow = {
  hour: string
  total_events: number
  activations: number
}

export type AlertData = {
  alert_type: string
  description: string
  timestamp: string
}

export type HealthStatus = {
  status: 'ok' | 'error'
  db?: string
}

export type ConnectionStatus = {
  mqtt: boolean
  api: boolean
}

export type SummaryKPIs = {
  todayActivations: number
  totalEvents: number
  avgResponseTime: number
  complianceRate: number
  co2Saved: number
  uptime: number
  peakHour: string
  totalPedestrians: number
  totalVehicles: number
  falsePositiveRate: number
}
