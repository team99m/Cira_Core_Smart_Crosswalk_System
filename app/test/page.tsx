'use client'

import { useState, useCallback } from 'react'

/* ═══════════════════════════════════════════
   Test Page — จำลองส่ง event ไปยังระบบ
   ═══════════════════════════════════════════ */

type TestResult = {
  id: number
  action: string
  status: 'success' | 'error' | 'pending'
  message: string
  timestamp: Date
}

export default function TestPage() {
  const [results, setResults] = useState<TestResult[]>([])
  const [running, setRunning] = useState(false)
  let resultId = 0

  const addResult = useCallback((action: string, status: 'success' | 'error' | 'pending', message: string) => {
    resultId++
    setResults((prev) => [
      { id: resultId, action, status, message, timestamp: new Date() },
      ...prev,
    ].slice(0, 50))
  }, [])

  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

  // ── Test: ส่ง barrier command ──
  const testBarrierCmd = async (cmd: 'open' | 'closed') => {
    addResult(`Barrier → ${cmd}`, 'pending', 'Sending...')
    await delay(300 + Math.random() * 400)
    const ok = Math.random() > 0.1
    addResult(
      `Barrier → ${cmd}`,
      ok ? 'success' : 'error',
      ok ? `Servo ${cmd === 'closed' ? 'lowered' : 'raised'} successfully (PWM duty: ${cmd === 'closed' ? 77 : 40})` : 'ESP32 not responding — timeout after 2s'
    )
  }

  // ── Test: จำลอง detection event ──
  const testDetection = async () => {
    addResult('Detection', 'pending', 'Capturing frame...')
    await delay(200 + Math.random() * 300)
    const persons = Math.floor(Math.random() * 4)
    const cars = Math.floor(Math.random() * 3)
    const conf = (0.7 + Math.random() * 0.28).toFixed(2)
    addResult(
      'Detection',
      'success',
      `Detected: ${persons} person(s), ${cars} vehicle(s) — confidence ${conf}`
    )
  }

  // ── Test: ส่ง event log ไป API ──
  const testEventLog = async () => {
    addResult('Event Log', 'pending', 'POST /api/events...')
    await delay(150 + Math.random() * 250)
    const ok = Math.random() > 0.05
    addResult(
      'Event Log',
      ok ? 'success' : 'error',
      ok ? 'Event saved to SQLite (id: ' + Math.floor(Math.random() * 500 + 100) + ')' : 'Database locked — retry'
    )
  }

  // ── Test: ตรวจสอบ API health ──
  const testHealth = async () => {
    addResult('Health Check', 'pending', 'GET /api/health...')
    await delay(100 + Math.random() * 150)
    addResult('Health Check', 'success', 'CiraCore API responding — status: ok')
  }

  // ── Test: ส่ง alert ──
  const testAlert = async () => {
    addResult('Alert', 'pending', 'Publishing alert...')
    await delay(200 + Math.random() * 300)
    const alerts = [
      'VEHICLE_IGNORING_BARRIER: Vehicle detected after barrier closed for 5+ seconds',
      'SENSOR_ANOMALY: Detection confidence dropped below threshold',
      'HIGH_TRAFFIC: Unusual traffic volume — 15+ vehicles/min',
    ]
    addResult('Alert', 'success', alerts[Math.floor(Math.random() * alerts.length)])
  }

  // ── Run all tests sequentially ──
  const runAllTests = async () => {
    setRunning(true)
    setResults([])

    addResult('Test Suite', 'pending', 'Starting full system test...')
    await delay(500)

    await testHealth()
    await delay(400)
    await testDetection()
    await delay(400)
    await testBarrierCmd('closed')
    await delay(600)
    await testEventLog()
    await delay(400)
    await testDetection()
    await delay(400)
    await testAlert()
    await delay(400)
    await testBarrierCmd('open')
    await delay(400)
    await testHealth()

    addResult('Test Suite', 'success', 'All tests completed ✓')
    setRunning(false)
  }

  const successCount = results.filter((r) => r.status === 'success').length
  const errorCount = results.filter((r) => r.status === 'error').length

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-[var(--border-subtle)]">
        <div className="max-w-7xl mx-auto px-5 h-12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="text-base font-semibold tracking-tight hover:text-neutral-300 transition-colors">
              ← Smart Crosswalk
            </a>
            <span className="text-[10px] text-neutral-600 bg-neutral-800/50 px-1.5 py-0.5 rounded">Test Mode</span>
          </div>
          <span className="text-[11px] text-neutral-500 tabular-nums">
            {new Date().toLocaleTimeString('th-TH')}
          </span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 py-6 space-y-6">
        {/* Title */}
        <div>
          <h1 className="text-xl font-semibold text-neutral-100">System Test</h1>
          <p className="text-sm text-neutral-500 mt-1">จำลองส่ง event และทดสอบการทำงานของระบบ</p>
        </div>

        {/* Test Buttons */}
        <div className="bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-subtle)] p-5">
          <p className="text-[11px] uppercase tracking-wider text-neutral-500 mb-4">Individual Tests</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <button
              onClick={() => testHealth()}
              disabled={running}
              className="px-4 py-3 text-xs font-medium rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] text-neutral-300 hover:bg-neutral-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              🏥 Health Check
            </button>
            <button
              onClick={() => testDetection()}
              disabled={running}
              className="px-4 py-3 text-xs font-medium rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] text-neutral-300 hover:bg-neutral-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              👁️ Detection
            </button>
            <button
              onClick={() => testBarrierCmd('closed')}
              disabled={running}
              className="px-4 py-3 text-xs font-medium rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] text-neutral-300 hover:bg-neutral-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              🔒 Barrier Close
            </button>
            <button
              onClick={() => testBarrierCmd('open')}
              disabled={running}
              className="px-4 py-3 text-xs font-medium rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] text-neutral-300 hover:bg-neutral-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              🔓 Barrier Open
            </button>
            <button
              onClick={() => testEventLog()}
              disabled={running}
              className="px-4 py-3 text-xs font-medium rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] text-neutral-300 hover:bg-neutral-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              📝 Event Log
            </button>
            <button
              onClick={() => testAlert()}
              disabled={running}
              className="px-4 py-3 text-xs font-medium rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] text-neutral-300 hover:bg-neutral-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              ⚠️ Alert
            </button>
          </div>

          <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
            <button
              onClick={runAllTests}
              disabled={running}
              className={`w-full px-4 py-3 text-sm font-medium rounded-lg transition-all ${
                running
                  ? 'bg-blue-900/40 text-blue-300 cursor-wait'
                  : 'bg-blue-600 text-white hover:bg-blue-500'
              }`}
            >
              {running ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-3.5 w-3.5 border-2 border-blue-300 border-t-transparent rounded-full animate-spin" />
                  Running Tests...
                </span>
              ) : (
                '▶ Run All Tests'
              )}
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-subtle)]">
          <div className="p-5 pb-0">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-medium text-neutral-200">Results</h2>
                <p className="text-xs text-neutral-500 mt-0.5">
                  {results.length > 0 && (
                    <span>
                      <span className="text-emerald-400">{successCount} passed</span>
                      {errorCount > 0 && <span className="text-red-400 ml-2">{errorCount} failed</span>}
                      <span className="text-neutral-600 ml-2">/ {results.length} total</span>
                    </span>
                  )}
                </p>
              </div>
              {results.length > 0 && (
                <button
                  onClick={() => setResults([])}
                  className="text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="max-h-[500px] overflow-y-auto">
            {results.length === 0 ? (
              <div className="py-12 text-center text-xs text-neutral-600">
                กดปุ่มทดสอบด้านบนเพื่อเริ่ม
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[var(--bg-elevated)]">
                  <tr className="border-t border-[var(--border-subtle)]">
                    <th className="text-left py-2 px-5 text-[11px] font-medium text-neutral-500 uppercase tracking-wider">Time</th>
                    <th className="text-left py-2 px-5 text-[11px] font-medium text-neutral-500 uppercase tracking-wider">Action</th>
                    <th className="text-left py-2 px-5 text-[11px] font-medium text-neutral-500 uppercase tracking-wider">Status</th>
                    <th className="text-left py-2 px-5 text-[11px] font-medium text-neutral-500 uppercase tracking-wider">Message</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr
                      key={r.id}
                      className="border-t border-[var(--border-subtle)] hover:bg-[var(--bg-hover)]/50 transition-colors animate-fade-in"
                    >
                      <td className="py-2.5 px-5 text-[11px] text-neutral-500 tabular-nums whitespace-nowrap">
                        {r.timestamp.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td className="py-2.5 px-5 text-xs text-neutral-300 font-medium whitespace-nowrap">
                        {r.action}
                      </td>
                      <td className="py-2.5 px-5">
                        <span
                          className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${
                            r.status === 'success'
                              ? 'text-emerald-400'
                              : r.status === 'error'
                              ? 'text-red-400'
                              : 'text-amber-400'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              r.status === 'success'
                                ? 'bg-emerald-400'
                                : r.status === 'error'
                                ? 'bg-red-400'
                                : 'bg-amber-400 animate-pulse'
                            }`} />
                          {r.status === 'success' ? 'PASS' : r.status === 'error' ? 'FAIL' : '...'}
                        </span>
                      </td>
                      <td className="py-2.5 px-5 text-[11px] text-neutral-400 max-w-xs truncate">
                        {r.message}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center text-[10px] text-neutral-700 pt-4 pb-6">
          Smart Crosswalk Test Suite — Mock Mode (ไม่ได้เชื่อมต่อกับ CiraCore จริง)
        </footer>
      </main>
    </div>
  )
}
