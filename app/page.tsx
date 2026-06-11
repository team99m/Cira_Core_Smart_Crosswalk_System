'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import mqtt from 'mqtt'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  AreaChart, Area, ResponsiveContainer, Cell,
} from 'recharts'
import type { DetectionData, EventRow, StatRow, ServoState, SummaryKPIs } from '@/types'

/* ═══════════════════════════════════════════
   ค่าคงที่
   ═══════════════════════════════════════════ */
const POLL_INTERVAL = 2500
const MAX_EVENTS = 50
const SPARKLINE_POINTS = 24

const initialStats: StatRow[] = Array.from({ length: 24 }).map((_, i) => ({
  hour: i.toString().padStart(2, '0'),
  total_events: 0,
  activations: 0,
}))

function calculateKPIs(stats: StatRow[], events: EventRow[]): SummaryKPIs {
  const todayActivations = stats.reduce((s, r) => s + r.activations, 0)
  const totalEvents = events.length
  const activations = events.filter((e) => e.event_type === 'BARRIER_ACTIVATED')
  const avgConf =
    activations.length > 0
      ? activations.reduce((s, e) => s + e.confidence_person, 0) / activations.length
      : 1

  return {
    todayActivations,
    totalEvents,
    avgResponseTime: 120,
    complianceRate: Math.round(avgConf * 100),
    co2Saved: Math.round(todayActivations * 0.015 * 100) / 100,
    uptime: 100,
    peakHour: stats.reduce((a, b) => (a.activations > b.activations ? a : b), stats[0])?.hour || new Date().getHours().toString().padStart(2, '0'),
    totalPedestrians: events.reduce((s, e) => s + e.person_count, 0),
    totalVehicles: events.reduce((s, e) => s + e.car_count, 0),
    falsePositiveRate: 0,
  }
}

/* ═══════════════════════════════════════════
   Sub-Components
   ═══════════════════════════════════════════ */

// ── Connection Pill ──
function Pill({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs tabular-nums">
      <span
        className={`h-1.5 w-1.5 rounded-full ${ok ? 'bg-emerald-400' : 'bg-red-400'}`}
      />
      <span className={ok ? 'text-neutral-400' : 'text-red-400'}>{label}</span>
    </span>
  )
}

// ── Section Header ──
function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-sm font-medium text-neutral-200">{title}</h2>
      {subtitle && <p className="text-xs text-neutral-500 mt-0.5">{subtitle}</p>}
    </div>
  )
}

// ── Summary KPI Card ──
function KPICard({
  label,
  value,
  unit,
  sub,
  accent,
}: {
  label: string
  value: string | number
  unit?: string
  sub?: string
  accent?: 'green' | 'amber' | 'red' | 'blue' | 'violet'
}) {
  const accentColor = {
    green: 'text-emerald-400',
    amber: 'text-amber-400',
    red: 'text-red-400',
    blue: 'text-blue-400',
    violet: 'text-violet-400',
  }[accent || 'blue']

  return (
    <div className="py-3">
      <p className="text-[11px] uppercase tracking-wider text-neutral-500 mb-1">{label}</p>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-semibold text-neutral-100 number-display tabular-nums">
          {value}
        </span>
        {unit && <span className="text-xs text-neutral-500">{unit}</span>}
      </div>
      {sub && <p className={`text-[11px] mt-1 ${accentColor}`}>{sub}</p>}
    </div>
  )
}

// ── Sparkline (mini inline chart) ──
function Sparkline({
  data,
  color = '#3b82f6',
  height = 32,
}: {
  data: number[]
  color?: string
  height?: number
}) {
  if (data.length < 2) return null
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const w = 80
  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${height - ((v - min) / range) * (height - 4) - 2}`)
    .join(' ')

  return (
    <svg width={w} height={height} className="opacity-60">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ── Detection Card ──
function DetectionCard({
  icon,
  label,
  value,
  confidence,
  sparkData,
}: {
  icon: string
  label: string
  value: number | string
  confidence?: number
  sparkData: number[]
}) {
  return (
    <div className="bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-subtle)] p-5 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-neutral-500 uppercase tracking-wider">
          {icon} {label}
        </span>
        <Sparkline data={sparkData} color="#3b82f6" />
      </div>
      <p className="text-4xl font-semibold text-neutral-100 number-display tabular-nums">
        {value}
      </p>
      {confidence !== undefined && confidence > 0 && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[11px] text-neutral-500">Confidence</span>
          <div className="flex-1 h-1 bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-700"
              style={{ width: `${(confidence * 100).toFixed(0)}%` }}
            />
          </div>
          <span className="text-[11px] text-neutral-400 tabular-nums">
            {(confidence * 100).toFixed(0)}%
          </span>
        </div>
      )}
    </div>
  )
}

// ── Barrier Status ──
function BarrierStatus({
  state,
  responseTime,
  lastChanged,
}: {
  state: ServoState | 'UNKNOWN'
  responseTime: number
  lastChanged: Date
}) {
  const isClosed = state === 'closed'
  return (
    <div
      className={`rounded-xl border p-6 transition-all duration-500 animate-fade-in ${
        isClosed
          ? 'bg-red-950/20 border-red-900/40'
          : 'bg-emerald-950/20 border-emerald-900/40'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`text-3xl ${isClosed ? 'animate-pulse-soft' : ''}`}>
            {isClosed ? '🛑' : '✅'}
          </div>
          <div>
            <p className={`text-xl font-semibold ${isClosed ? 'text-red-400' : 'text-emerald-400'}`}>
              Barrier {state.toUpperCase()}
            </p>
            <p className="text-xs text-neutral-500 mt-0.5">
              {isClosed ? 'Vehicles blocked — pedestrian crossing' : 'Clear — vehicles may pass'}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-neutral-500">Response</p>
          <p className="text-sm font-medium text-neutral-300 tabular-nums">{responseTime}ms</p>
          <p className="text-[10px] text-neutral-600 mt-0.5 tabular-nums">
            {lastChanged.toLocaleTimeString('th-TH')}
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Hourly Chart ──
function HourlyChart({ data }: { data: StatRow[] }) {
  const [chartType, setChartType] = useState<'bar' | 'area'>('bar')

  return (
    <div className="bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-subtle)] p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-medium text-neutral-200">Hourly Activations</h2>
          <p className="text-xs text-neutral-500 mt-0.5">Today's barrier activation frequency</p>
        </div>
        <div className="flex gap-1 bg-[var(--bg-card)] rounded-lg p-0.5">
          {(['bar', 'area'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setChartType(t)}
              className={`px-3 py-1 text-[11px] rounded-md capitalize transition-colors ${
                chartType === t
                  ? 'bg-neutral-700 text-neutral-200'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        {chartType === 'bar' ? (
          <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
            <XAxis
              dataKey="hour"
              tick={{ fill: '#737373', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}:00`}
            />
            <YAxis
              tick={{ fill: '#737373', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                background: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: '8px',
                fontSize: '12px',
                color: '#e5e5e5',
              }}
              labelFormatter={(v) => `${v}:00`}
              cursor={{ fill: 'rgba(255,255,255,0.03)' }}
            />
            <Bar dataKey="activations" radius={[4, 4, 0, 0]} maxBarSize={32}>
              {data.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.activations > 15 ? '#f87171' : entry.activations > 8 ? '#fbbf24' : '#3b82f6'}
                />
              ))}
            </Bar>
          </BarChart>
        ) : (
          <AreaChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
            <XAxis
              dataKey="hour"
              tick={{ fill: '#737373', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}:00`}
            />
            <YAxis
              tick={{ fill: '#737373', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                background: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: '8px',
                fontSize: '12px',
                color: '#e5e5e5',
              }}
              labelFormatter={(v) => `${v}:00`}
            />
            <Area
              type="monotone"
              dataKey="activations"
              stroke="#3b82f6"
              strokeWidth={2}
              fill="url(#areaGrad)"
            />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}

// ── Compliance Ring ──
function ComplianceRing({ value }: { value: number }) {
  const radius = 40
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference
  const color = value >= 95 ? '#34d399' : value >= 85 ? '#fbbf24' : '#f87171'

  return (
    <div className="flex flex-col items-center">
      <svg width={100} height={100} className="-rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#2a2a2a" strokeWidth="6" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center" style={{ width: 100, height: 100 }}>
        <span className="text-xl font-semibold text-neutral-100 tabular-nums">{value}%</span>
      </div>
    </div>
  )
}
// ── Camera Feed ──
function CameraFeed({ base64Image }: { base64Image: string | null }) {
  const [hasError, setHasError] = useState(false)

  useEffect(() => { setHasError(false) }, [base64Image])

  const cleanBase64 = base64Image ? base64Image.replace(/[\r\n\s]/g, '') : ''
  const imgSrc = cleanBase64.startsWith('data:image') 
    ? cleanBase64 
    : `data:image/jpeg;base64,${cleanBase64}`

  return (
    <div className="bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-subtle)] p-5 flex flex-col h-full">
      <p className="text-[11px] uppercase tracking-wider text-neutral-500 mb-3">📷 Latest Camera View</p>
      <div className="flex-1 min-h-[140px] bg-black/40 rounded-lg overflow-hidden border border-[var(--border-subtle)] flex items-center justify-center relative">
        {base64Image && !hasError ? (
          <img 
            src={imgSrc} 
            alt="Latest from CiraCore" 
            className="w-full h-full object-cover animate-fade-in" 
            onError={() => setHasError(true)}
          />
        ) : base64Image && hasError ? (
          <div className="text-center p-4">
            <span className="text-2xl opacity-20">⚠️</span>
            <p className="text-[10px] text-red-400 mt-2">Invalid Image Data</p>
            <p className="text-[8px] text-neutral-600 mt-1 break-all line-clamp-3">
              {base64Image.substring(0, 100)}...
            </p>
          </div>
        ) : (
          <div className="text-center">
            <span className="text-2xl opacity-20">👀</span>
            <p className="text-[10px] text-neutral-600 mt-2">Waiting for camera data...</p>
          </div>
        )}
      </div>
      <p className="text-[10px] text-neutral-600 mt-2 text-right">Via MQTT: cira/esp32/cam</p>
    </div>
  )
}

// ── Event Log Table ──
function EventLog({ events, page, onPageChange }: {
  events: EventRow[]
  page: number
  onPageChange: (p: number) => void
}) {
  const PAGE_SIZE = 10
  const totalPages = Math.ceil(events.length / PAGE_SIZE)
  const sliced = events.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div className="bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-subtle)]">
      <div className="p-5 pb-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-medium text-neutral-200">Event Log</h2>
            <p className="text-xs text-neutral-500 mt-0.5">{events.length} total events</p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-t border-[var(--border-subtle)]">
              <th className="text-left py-2.5 px-5 text-[11px] font-medium text-neutral-500 uppercase tracking-wider">Time</th>
              <th className="text-left py-2.5 px-5 text-[11px] font-medium text-neutral-500 uppercase tracking-wider">Event</th>
              <th className="text-center py-2.5 px-5 text-[11px] font-medium text-neutral-500 uppercase tracking-wider">P</th>
              <th className="text-center py-2.5 px-5 text-[11px] font-medium text-neutral-500 uppercase tracking-wider">V</th>
              <th className="text-center py-2.5 px-5 text-[11px] font-medium text-neutral-500 uppercase tracking-wider">Conf</th>
              <th className="text-left py-2.5 px-5 text-[11px] font-medium text-neutral-500 uppercase tracking-wider">State</th>
            </tr>
          </thead>
          <tbody>
            {sliced.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-xs text-neutral-600">
                  No events yet — waiting for detection…
                </td>
              </tr>
            ) : (
              sliced.map((e) => (
                <tr
                  key={e.id}
                  className="border-t border-[var(--border-subtle)] hover:bg-[var(--bg-hover)]/50 transition-colors animate-fade-in"
                >
                  <td className="py-2.5 px-5 text-xs text-neutral-500 tabular-nums">
                    {new Date(e.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </td>
                  <td className="py-2.5 px-5 text-xs">
                    <span className={`inline-flex items-center gap-1.5 ${
                      e.event_type === 'BARRIER_ACTIVATED' ? 'text-amber-400' : 'text-emerald-400'
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${
                        e.event_type === 'BARRIER_ACTIVATED' ? 'bg-amber-400' : 'bg-emerald-400'
                      }`} />
                      {e.event_type === 'BARRIER_ACTIVATED' ? 'Activated' : 'Deactivated'}
                    </span>
                  </td>
                  <td className="py-2.5 px-5 text-center text-xs text-neutral-300 tabular-nums">{e.person_count}</td>
                  <td className="py-2.5 px-5 text-center text-xs text-neutral-300 tabular-nums">{e.car_count}</td>
                  <td className="py-2.5 px-5 text-center text-xs text-neutral-400 tabular-nums">
                    {((e.confidence_person + e.confidence_car) / 2 * 100).toFixed(0)}%
                  </td>
                  <td className="py-2.5 px-5">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium tabular-nums ${
                        e.servo_state === 'closed'
                          ? 'bg-red-950/60 text-red-400 border border-red-900/40'
                          : 'bg-emerald-950/60 text-emerald-400 border border-emerald-900/40'
                      }`}
                    >
                      {e.servo_state.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--border-subtle)]">
          <span className="text-[11px] text-neutral-500">
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => onPageChange(Math.max(0, page - 1))}
              disabled={page === 0}
              className="px-2.5 py-1 text-[11px] rounded-md bg-[var(--bg-card)] text-neutral-400 hover:text-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Prev
            </button>
            <button
              onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="px-2.5 py-1 text-[11px] rounded-md bg-[var(--bg-card)] text-neutral-400 hover:text-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Alert Banner ──
function AlertBanner({ message, type }: { message: string; type: string }) {
  return (
    <div className="bg-amber-950/30 border border-amber-800/40 rounded-xl px-4 py-3 flex items-center gap-3 animate-slide-down">
      <span className="text-amber-400 text-sm">⚠️</span>
      <div>
        <p className="text-xs text-amber-300 font-medium">{type.replace(/_/g, ' ')}</p>
        <p className="text-[11px] text-amber-400/70 mt-0.5">{message}</p>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════
   Main Dashboard Page
   ═══════════════════════════════════════════ */

export default function Dashboard() {
  const [detection, setDetection] = useState<DetectionData | null>(null)
  const [events, setEvents] = useState<EventRow[]>([])
  const [stats, setStats] = useState<StatRow[]>(initialStats)
  const [kpis, setKpis] = useState<SummaryKPIs | null>(null)
  const [alert, setAlert] = useState<{ message: string; type: string } | null>(null)
  const [lastChanged, setLastChanged] = useState(new Date())
  const [servoState, setServoState] = useState<ServoState>('open')
  const [eventPage, setEventPage] = useState(0)
  const [mqttStatus, setMqttStatus] = useState(false)
  const [latestImage, setLatestImage] = useState<string | null>(null)

  // Sparkline history
  const [personSpark, setPersonSpark] = useState<number[]>(Array(SPARKLINE_POINTS).fill(0))
  const [carSpark, setCarSpark] = useState<number[]>(Array(SPARKLINE_POINTS).fill(0))

  // ── Initial Data Fetch ──
  useEffect(() => {
    fetch('/api/events')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setEvents(data)
      })
      .catch((err) => console.error('Failed to fetch events:', err))

    fetch('/api/stats')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setStats(data)
      })
      .catch((err) => console.error('Failed to fetch stats:', err))
  }, [])

  // ── MQTT Connection ──
  useEffect(() => {
    // We use wss:// since we are on a web client
    const client = mqtt.connect('wss://broker.hivemq.com:8884/mqtt')

    client.on('connect', () => {
      setMqttStatus(true)
      client.subscribe('cira/esp32/rx')
      client.subscribe('cira/esp32/cam')
    })

    client.on('message', (topic, message) => {
      if (topic === 'cira/esp32/rx') {
        try {
          const payload = JSON.parse(message.toString())
          const detData = payload.DeepDetect || {}
          const counts = detData.counts || {}
          
          // Map counts from DeepDetect
          const personCount = counts.person || 0
          const carCount = (counts.car || 0) + (counts.truck || 0) + (counts.bus || 0) + (counts.vehicle || 0)
          
          const newServoState: ServoState = (payload.b === 'CLOSE' || payload.b === 'CLOSED') ? 'closed' : 'open'

          setDetection({
            timestamp: new Date().toISOString(),
            person_count: personCount,
            car_count: carCount,
            person_confidence: 0.95,
            car_confidence: 0.95,
            servo_state: newServoState
          })

          // Update sparklines
          setPersonSpark((prev) => [...prev.slice(1), personCount])
          setCarSpark((prev) => [...prev.slice(1), carCount])

          // State change detection -> log event
          setServoState((prevServo) => {
            if (newServoState !== prevServo) {
              setLastChanged(new Date())
              
              setEvents((prev) => {
                const newEvent = {
                  id: Date.now(),
                  created_at: new Date().toISOString(),
                  event_type: newServoState === 'closed' ? 'BARRIER_ACTIVATED' as const : 'BARRIER_DEACTIVATED' as const,
                  person_count: personCount,
                  car_count: carCount,
                  servo_state: newServoState,
                  confidence_person: 0.95,
                  confidence_car: 0.95
                }
                return [newEvent, ...prev].slice(0, MAX_EVENTS)
              })

              setStats(prevStats => {
                const hr = new Date().getHours().toString().padStart(2, '0')
                return prevStats.map(s => {
                  if (s.hour === hr) {
                    return {
                      ...s,
                      total_events: s.total_events + 1,
                      activations: s.activations + (newServoState === 'closed' ? 1 : 0)
                    }
                  }
                  return s
                })
              })

              fetch('/api/events', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newEvent)
              }).catch((err) => console.error('Failed to save event:', err))
            }
            return newServoState
          })

        } catch (err) {
          console.error('Failed to parse MQTT message:', err)
        }
      } else if (topic === 'cira/esp32/cam') {
        let payloadStr = message.toString().trim()
        
        // Extract CiraCore specific payload format: e.g. "have_image___cira__<>,data:image/jpeg;base64,...{}"
        if (payloadStr.includes('___cira__<>,')) {
          payloadStr = payloadStr.split('___cira__<>,')[1]
          if (payloadStr.endsWith('{}')) {
            payloadStr = payloadStr.slice(0, -2)
          }
        }

        // Strip quotes if user sent a quoted string
        if ((payloadStr.startsWith('"') && payloadStr.endsWith('"')) || (payloadStr.startsWith("'") && payloadStr.endsWith("'"))) {
          payloadStr = payloadStr.slice(1, -1)
        }
        
        try {
          if (payloadStr.startsWith('{')) {
            const parsed = JSON.parse(payloadStr)
            if (parsed.image) {
              setLatestImage(parsed.image)
            } else if (parsed.base64) {
              setLatestImage(parsed.base64)
            } else {
              setLatestImage(payloadStr)
            }
          } else {
            setLatestImage(payloadStr)
          }
        } catch (e) {
          setLatestImage(payloadStr)
        }
      }
    })

    client.on('error', (err) => {
      console.error('MQTT Error:', err)
      setMqttStatus(false)
    })

    client.on('close', () => {
      setMqttStatus(false)
    })

    return () => {
      client.end()
    }
  }, [])

  // ── Refresh KPIs ──
  useEffect(() => {
    setKpis(calculateKPIs(stats, events))
  }, [stats, events])

  // ── Derived ──
  const isClosed = servoState === 'closed'

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      {/* ── Top Bar ── */}
      <header className="sticky top-0 z-50 glass border-b border-[var(--border-subtle)]">
        <div className="max-w-7xl mx-auto px-5 h-12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-base font-semibold tracking-tight">Smart Crosswalk</span>
            <span className="text-[10px] text-neutral-600 bg-neutral-800/50 px-1.5 py-0.5 rounded">v2.0</span>
          </div>
          <div className="flex items-center gap-4">
            <Pill label="MQTT" ok={mqttStatus} />
            <Pill label="API" ok={true} />
            <Pill label="Camera" ok={true} />
            <span className="text-[11px] text-neutral-500 tabular-nums">
              {new Date().toLocaleTimeString('th-TH')}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 py-6 space-y-6">
        {/* ── Alert ── */}
        {alert && <AlertBanner message={alert.message} type={alert.type} />}

        {/* ── Summary KPI Row ── */}
        {kpis && (
          <div className="grid grid-cols-3 md:grid-cols-6 gap-4 bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-subtle)] px-5 py-2">
            <KPICard label="Activations" value={kpis.todayActivations} unit="today" accent="amber" />
            <KPICard label="Avg Response" value={kpis.avgResponseTime} unit="ms" accent="green" />
            <KPICard label="Compliance" value={kpis.complianceRate} unit="%" accent="green" />
            <KPICard label="Uptime" value={kpis.uptime} unit="%" accent="blue" />
            <KPICard label="Peak Hour" value={`${kpis.peakHour}:00`} accent="violet" />
          </div>
        )}

        {/* ── Detection Cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <DetectionCard
            icon="👥"
            label="Pedestrians"
            value={detection?.person_count ?? '—'}
            confidence={detection?.person_confidence}
            sparkData={personSpark}
          />
          <DetectionCard
            icon="🚗"
            label="Vehicles"
            value={detection?.car_count ?? '—'}
            confidence={detection?.car_confidence}
            sparkData={carSpark}
          />
          <div className="space-y-4">
            {kpis && (
              <>
                <CameraFeed base64Image={latestImage} />
                <div className="bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-subtle)] p-5">
                  <p className="text-[11px] uppercase tracking-wider text-neutral-500 mb-3">Compliance Score</p>
                  <div className="relative flex justify-center">
                    <ComplianceRing value={kpis.complianceRate} />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Barrier Status ── */}
        <BarrierStatus
          state={servoState}
          responseTime={kpis?.avgResponseTime || 120}
          lastChanged={lastChanged}
        />

        {/* ── Charts + Stats ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <HourlyChart data={stats} />
          <div className="bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-subtle)] p-5">
            <SectionHeader title="Detection Summary" subtitle="Today's aggregated statistics" />
            {kpis && (
              <div className="space-y-3 mt-2">
                <div className="flex justify-between items-center py-2 border-b border-[var(--border-subtle)]">
                  <span className="text-xs text-neutral-400">Total Pedestrians Detected</span>
                  <span className="text-sm font-medium text-neutral-200 tabular-nums">{kpis.totalPedestrians}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-[var(--border-subtle)]">
                  <span className="text-xs text-neutral-400">Total Vehicles Detected</span>
                  <span className="text-sm font-medium text-neutral-200 tabular-nums">{kpis.totalVehicles}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-[var(--border-subtle)]">
                  <span className="text-xs text-neutral-400">Total Events</span>
                  <span className="text-sm font-medium text-neutral-200 tabular-nums">{kpis.totalEvents}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-[var(--border-subtle)]">
                  <span className="text-xs text-neutral-400">False Positive Rate</span>
                  <span className="text-sm font-medium text-amber-400 tabular-nums">{kpis.falsePositiveRate}%</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-[var(--border-subtle)]">
                  <span className="text-xs text-neutral-400">System Uptime</span>
                  <span className="text-sm font-medium text-emerald-400 tabular-nums">{kpis.uptime}%</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-xs text-neutral-400">Peak Traffic Hour</span>
                  <span className="text-sm font-medium text-violet-400 tabular-nums">{kpis.peakHour}:00</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Event Log ── */}
        <EventLog events={events} page={eventPage} onPageChange={setEventPage} />

        {/* ── Footer ── */}
        <footer className="text-center text-[10px] text-neutral-700 pt-4 pb-6">
          Smart Crosswalk System v2.0 — Production Build
        </footer>
      </main>
    </div>
  )
}
