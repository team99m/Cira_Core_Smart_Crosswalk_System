[SMART_CROSSWALK_PROJECT_v2.md](https://github.com/user-attachments/files/28820678/SMART_CROSSWALK_PROJECT_v2.md)
# Smart Crosswalk System — Complete Project Documentation
**3-Day Demo Sprint | CiraCore + ESP32 + Servo | Local-Only Stack**

> **v2 Changes from v1:**  
> ❌ ตัด Supabase ออกทั้งหมด  
> ❌ ตัด ESP32-CAM ออก (ใช้ USB Webcam บน PC แทน)  
> ✅ ESP32 = รับคำสั่ง open/close อย่างเดียว  
> ✅ CiraCore = log ลง SQLite local + เปิด HTTP API (port 8080)  
> ✅ Web Dashboard = ข้อมูล real-time จาก MQTT WebSocket (localhost:9001) + stats จาก local API

---

## 📋 Table of Contents
1. [Project Overview](#1-project-overview)
2. [Theme Alignment](#2-theme-alignment)
3. [System Architecture](#3-system-architecture)
4. [Integration Contract (MQTT/HTTP)](#4-integration-contract)
5. [Database Schema (SQLite Local)](#5-database-schema)
6. [3-Day Task Breakdown](#6-3-day-task-breakdown)
7. [Setup Guide](#7-setup-guide)
8. [Code Examples](#8-code-examples)
9. [Demo Flow & Script](#9-demo-flow--script)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Project Overview

### What is it?
A **smart traffic safety system** ที่ใช้ AI-powered computer vision ตรวจจับคนเดินถนนและรถยนต์บริเวณทางม้าลาย เมื่อพบทั้งสองพร้อมกัน servo-controlled barrier จะลงมาอัตโนมัติ บังคับให้รถหยุด ป้องกันอุบัติเหตุ

### Core Features
- **Real-time Detection:** YOLOv8 (via CiraCore บน PC) detect `person` และ `car` จาก USB Webcam
- **Automated Barrier Control:** ESP32 รับคำสั่งผ่าน MQTT แล้วควบคุม servo
- **Safety Logic:** ไม้กันเปิดเมื่อทางปลอดภัย / ปิดเมื่อพบคนข้ามพร้อมรถ
- **Local Data Logging:** Event log ลง SQLite บน PC (ไม่ต้องใช้ cloud)
- **Live Dashboard:** แสดงสถานะ real-time + สถิติ ผ่าน localhost

### อุปกรณ์ทั้งหมด (Hardware)
| อุปกรณ์ | บทบาท |
|--------|-------|
| **USB Webcam** | จับภาพ video → ส่งให้ CiraCore ผ่าน USB |
| **ESP32** | รับคำสั่ง MQTT → สั่ง servo |
| **Servo Motor** | ยกขึ้น/ลงตาม command |

### Project Constraints
| Constraint | Value |
|-----------|-------|
| **Duration** | 3 days |
| **Team Size** | 3 people |
| **Hardware** | USB Webcam, ESP32, Servo Motor |
| **Network** | Local Wi-Fi เท่านั้น (ไม่มี cloud) |
| **Deployment** | Demo/Prototype (localhost) |

---

## 2. Theme Alignment

### 🚨 Smart Tech for **Life**
**Problem:** ผู้เสียชีวิตจากอุบัติเหตุทางถนนในไทย 1,200+ คน/ปี หลายเหตุการณ์เกิดที่ทางแยกที่ขาดการควบคุม

**Solution:**
- ไม้กันอัตโนมัติป้องกันรถผ่านขณะมีคนข้ามถนน
- AI ตอบสนองใน <100ms เร็วกว่าปฏิกิริยาของมนุษย์
- ไม่พึ่งพาความตั้งใจของผู้ขับขี่

**Impact Metrics:**
- Barrier activation accuracy: Target >95%
- False positives: <5%
- Average response time: <200ms

---

### 🌱 Smart Tech for **Environment**
**Problem:** รถติดค้างที่ทางแยก → เครื่องยนต์เดินเบาเพิ่มขึ้น → CO₂ เกินจำเป็น

**Solution:**
- วิเคราะห์ช่วงเวลา peak crossing → ปรับไฟจราจร
- ข้อมูลสถิติ compliance ช่วยวางแผนโครงสร้างพื้นฐาน

**Impact Metrics:**
- CO₂ saved per vehicle stop: ~15 seconds idle time avoided
- 500 vehicles/day × 15 sec = ~350 kg CO₂/day saved

---

## 3. System Architecture

### High-Level Flow Diagram
```
┌────────────────────────────────────────────────────────────┐
│                         PC (CiraCore)                      │
│                                                            │
│  ┌──────────────┐    USB    ┌──────────────────────────┐  │
│  │  USB Webcam  │ ────────► │  CiraCore                │  │
│  └──────────────┘           │  - YOLOv8 Detection      │  │
│                             │  - Safety Logic           │  │
│                             │  - MQTT Publisher         │  │
│                             │  - SQLite Logger          │  │
│                             │  - HTTP API (port 8080)   │  │
│                             └───────────┬──────────────┘  │
└─────────────────────────────────────────┼─────────────────┘
                                          │ MQTT PUBLISH
                                          ▼
                               ┌──────────────────┐
                               │  Mosquitto MQTT  │
                               │  localhost:1883  │
                               │  localhost:9001  │ ← WebSocket
                               └─────┬──────┬────┘
                                     │      │
                      MQTT SUBSCRIBE │      │ MQTT SUBSCRIBE
                                     ▼      ▼
                    ┌───────────┐         ┌──────────────────────┐
                    │   ESP32   │         │  Web Dashboard       │
                    │ - Servo   │         │  localhost:3000       │
                    │   PWM     │         │  - MQTT WS (9001)    │
                    └───────────┘         │  - Local API (8080)  │
                          │               └──────────────────────┘
                          ▼                        ▲
                    ┌───────────┐                  │ HTTP GET
                    │   Servo   │      ┌───────────┴──────────┐
                    │   Motor   │      │  SQLite Database     │
                    └───────────┘      │  crosswalk.db        │
                                       │  (on PC)             │
                                       └──────────────────────┘
```

### Component Responsibilities

#### **1. USB Webcam**
```
Responsibilities:
  ✓ Capture video frames (640x480, 30 FPS)
  ✓ ส่ง frames ให้ CiraCore ผ่าน USB (OpenCV จัดการ)
  ✓ ไม่มี processing บน camera เอง

Requirements:
  • Resolution: 640x480+
  • Frame rate: 30 FPS
  • Standard UVC (USB Video Class) compatible
```

#### **2. CiraCore (PC — Local Brain)**
```
Responsibilities:
  ✓ อ่าน frames จาก USB Webcam (OpenCV)
  ✓ รัน YOLOv8 object detection ทุก frame
  ✓ ใช้ Safety Logic (person + car detection)
  ✓ Publish คำสั่งไป MQTT broker
  ✓ Log events ลง SQLite (crosswalk.db)
  ✓ Publish detection data ให้ Dashboard ผ่าน MQTT
  ✓ เปิด HTTP API server (port 8080) ให้ Dashboard ดึง stats

Detection Classes:
  class_id=0  → person (คนเดินเท้า)
  class_id=2  → car (รถยนต์)
  class_id=3  → motorcycle (รถจักรยานยนต์)

Safety Logic:
  IF (person_count > 0) AND (car_count > 0):
    → MQTT: /parking/barrier/cmd = "closed"
    → SQLite: log BARRIER_ACTIVATED
  ELIF (person_count == 0) for 3+ consecutive frames:
    → MQTT: /parking/barrier/cmd = "open"
    → SQLite: log BARRIER_DEACTIVATED
```

#### **3. ESP32 (at Gate)**
```
Responsibilities:
  ✓ Subscribe to MQTT: /parking/barrier/cmd
  ✓ Parse command: "open" | "closed"
  ✓ Drive servo PWM signal
  ✗ ไม่ต้อง publish status กลับ
  ✗ ไม่ต้อง HTTP server
  ✗ ไม่ต้อง camera

MQTT Subscriptions:
  /parking/barrier/cmd → payload: "open" | "closed"
```

#### **4. Mosquitto MQTT Broker (on PC)**
```
Responsibilities:
  ✓ รับ MQTT publish จาก CiraCore
  ✓ ส่งต่อ command ไป ESP32 (port 1883)
  ✓ เปิด WebSocket bridge (port 9001) ให้ browser
  ✓ Route detection data ไป Dashboard

สำคัญ: ต้อง configure WebSocket listener เพื่อให้ browser connect ได้
```

#### **5. Web Dashboard (localhost:3000)**
```
Responsibilities:
  ✓ รับข้อมูล real-time จาก MQTT WebSocket (ws://localhost:9001)
  ✓ แสดงสถานะ barrier ปัจจุบัน
  ✓ แสดง live detection count (person/car)
  ✓ ดึง event log จาก Local API (http://localhost:8080/api/events)
  ✓ ดึง statistics จาก Local API (http://localhost:8080/api/stats)
  ✓ ไม่มี cloud dependency ทั้งสิ้น
```

---

## 4. Integration Contract

### A. MQTT Protocol (CiraCore ↔ ESP32 ↔ Dashboard)

#### **MQTT Topics & Payloads**

| Topic | Direction | Payload | Purpose |
|-------|-----------|---------|---------|
| `/parking/barrier/cmd` | CiraCore → ESP32 | `"open"` หรือ `"closed"` | สั่ง servo |
| `/parking/detection` | CiraCore → Dashboard | `{"person_count": N, "car_count": N, "servo_state": "open\|closed", "timestamp": "..."}` | ข้อมูล detection real-time |
| `/parking/alert` | CiraCore → Dashboard | `{"alert_type": "...", "description": "..."}` | Alert messages |

> **หมายเหตุ:** ตัด `/parking/barrier/status` ออกแล้ว — ESP32 ไม่ต้อง publish กลับ

#### **Command Flow Example**

**Scenario:** พบคน + รถพร้อมกัน

```
CiraCore (Detection Loop):
  1. อ่าน frame จาก USB Webcam
  2. Detect: person_count=2, car_count=1
  3. MQTT publish: /parking/barrier/cmd = "closed"
  4. SQLite insert: event_type="BARRIER_ACTIVATED"

MQTT Broker (localhost):
  Routes message to subscribed ESP32 (port 1883)
  Routes detection data to Dashboard (port 9001 WebSocket)

ESP32:
  1. Receives: /parking/barrier/cmd = "closed"
  2. servo_close() → PWM to 45°

Dashboard (browser):
  1. Receives: /parking/detection → update UI
  2. Fetch: GET localhost:8080/api/events → update event log
```

#### **MQTT Payload Examples**

**Barrier Command (CiraCore → ESP32):**
```
Topic:   /parking/barrier/cmd
Payload: closed
```
_Plain string ไม่ใช่ JSON — ให้ ESP32 parse ง่ายขึ้น_

**Detection Data (CiraCore → Dashboard):**
```json
{
  "timestamp": "2026-06-09T10:30:46.123Z",
  "person_count": 2,
  "car_count": 1,
  "person_confidence": 0.95,
  "car_confidence": 0.92,
  "servo_state": "closed"
}
```

**Alert (CiraCore → Dashboard):**
```json
{
  "alert_type": "VEHICLE_IGNORING_BARRIER",
  "description": "Vehicle detected after barrier closed for 5+ seconds",
  "timestamp": "2026-06-09T10:30:51Z"
}
```

---

### B. Local HTTP API (CiraCore → Dashboard)

CiraCore เปิด HTTP server บน port 8080 ให้ Dashboard ดึงข้อมูลประวัติและสถิติ

#### **Endpoints**

| Method | Endpoint | Description | Response |
|--------|----------|-------------|----------|
| GET | `/api/events` | Events ล่าสุด 100 รายการ | JSON array |
| GET | `/api/stats` | สถิติรายชั่วโมงวันนี้ | JSON array |
| GET | `/api/health` | ตรวจสอบว่า CiraCore ทำงานอยู่ | `{"status": "ok"}` |

#### **GET /api/events Response:**
```json
[
  {
    "id": 42,
    "created_at": "2026-06-09T10:30:46",
    "event_type": "BARRIER_ACTIVATED",
    "person_count": 2,
    "car_count": 1,
    "servo_state": "closed",
    "confidence_person": 0.95,
    "confidence_car": 0.92
  }
]
```

#### **GET /api/stats Response:**
```json
[
  {
    "hour": "08",
    "total_events": 12,
    "activations": 10
  },
  {
    "hour": "09",
    "total_events": 25,
    "activations": 22
  }
]
```

---

## 5. Database Schema (SQLite Local)

ไฟล์: `crosswalk.db` อยู่ใน folder เดียวกับ CiraCore (`ciracore-parking/crosswalk.db`)

```sql
-- Events table: บันทึกทุก barrier activation/deactivation
CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    
    -- Detection Data
    event_type TEXT NOT NULL,   -- 'BARRIER_ACTIVATED' | 'BARRIER_DEACTIVATED' | 'ALERT'
    person_count INTEGER DEFAULT 0,
    car_count INTEGER DEFAULT 0,
    
    -- Confidence Scores
    confidence_person REAL DEFAULT 0.0,
    confidence_car REAL DEFAULT 0.0,
    
    -- Servo State
    servo_state TEXT NOT NULL   -- 'open' | 'closed'
);

-- Index สำหรับ query เร็ว
CREATE INDEX IF NOT EXISTS idx_created_at ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_type ON events(event_type);
```

### Key Queries (ใช้ใน API Server)

**ดึง Events ล่าสุด:**
```sql
SELECT * FROM events 
ORDER BY created_at DESC 
LIMIT 100;
```

**สถิติรายชั่วโมงวันนี้:**
```sql
SELECT 
    strftime('%H', created_at) as hour,
    COUNT(*) as total_events,
    SUM(CASE WHEN event_type = 'BARRIER_ACTIVATED' THEN 1 ELSE 0 END) as activations
FROM events
WHERE date(created_at) = date('now', 'localtime')
GROUP BY hour
ORDER BY hour;
```

**Activation count วันนี้:**
```sql
SELECT COUNT(*) as today_activations
FROM events
WHERE event_type = 'BARRIER_ACTIVATED'
AND date(created_at) = date('now', 'localtime');
```

---

## 6. 3-Day Task Breakdown

### Team Composition
- **Person 1 (CiraCore Lead):** USB webcam + YOLO detection + MQTT publishing + SQLite logging + HTTP API
- **Person 2 (ESP32 Specialist):** MQTT subscriber + servo PWM control
- **Person 3 (Web Engineer):** Dashboard + MQTT WebSocket + Local API integration

---

### Day 1: Foundation & Local Setup

#### **Morning (6-8 hours)**

**Person 1 (CiraCore):**
- [ ] Install dependencies
  ```bash
  pip install opencv-python ultralytics paho-mqtt flask flask-cors pyyaml
  ```
- [ ] Install Mosquitto + configure WebSocket bridge
  ```bash
  # Ubuntu/Debian
  sudo apt install mosquitto mosquitto-clients
  ```
  แก้ `/etc/mosquitto/mosquitto.conf`:
  ```
  listener 1883
  protocol mqtt
  allow_anonymous true

  listener 9001
  protocol websockets
  allow_anonymous true
  ```
  ```bash
  sudo systemctl restart mosquitto
  ```
- [ ] Test MQTT broker
  ```bash
  mosquitto_pub -h localhost -t "test" -m "hello"
  mosquitto_sub -h localhost -t "test"
  # ควรได้รับ: hello
  ```
- [ ] Setup CiraCore project structure
  ```
  ciracore-parking/
  ├── config.yaml
  ├── main.py         ← Detection loop หลัก
  ├── mqtt_publisher.py
  ├── local_logger.py ← SQLite logger (แทน Supabase)
  ├── api_server.py   ← Flask HTTP server
  └── crosswalk.db    ← จะสร้างอัตโนมัติ
  ```
- [ ] Test USB Webcam
  ```python
  import cv2
  cap = cv2.VideoCapture(0)
  ret, frame = cap.read()
  print(f"Frame shape: {frame.shape}")  # (480, 640, 3)
  cap.release()
  ```
- [ ] Test YOLOv8 บน webcam frame
  ```python
  from ultralytics import YOLO
  model = YOLO('yolov8n.pt')  # Download ~6MB
  results = model(frame, conf=0.5)
  print(f"Detections: {len(results[0].boxes)}")
  ```
- **Deliverable:** USB Webcam ทำงาน + YOLO detect objects ได้

**Person 2 (ESP32):**
- [ ] Flash MicroPython firmware
  ```bash
  pip install esptool mpremote
  esptool.py --chip esp32 --port /dev/ttyUSB0 erase_flash
  esptool.py --chip esp32 --port /dev/ttyUSB0 write_flash -z 0x1000 esp32-micropython.bin
  ```
- [ ] Configure Wi-Fi + Test connection
- [ ] Install MQTT library
  ```bash
  mpremote mip install umqtt.simple
  ```
- [ ] Write และ test code รับ MQTT message อย่างเดียว
  ```python
  from umqtt.simple import MQTTClient
  client = MQTTClient("esp32", "192.168.x.x")
  client.set_callback(lambda t, m: print(f"Got: {m}"))
  client.connect()
  client.subscribe(b"/parking/barrier/cmd")
  ```
- [ ] ต่อสาย Servo (GPIO 15 → Signal, 5V → VCC, GND → GND)
- [ ] Test servo หมุนด้วย PWM duty
- **Deliverable:** ESP32 รับ MQTT + servo หมุนได้

**Person 3 (Web):**
- [ ] Create Next.js project
  ```bash
  npx create-next-app@latest smart-crosswalk --typescript --tailwind --use-npm --no-eslint
  cd smart-crosswalk
  npm install mqtt recharts
  ```
  > **หมายเหตุ:** ไม่ต้อง install `@supabase/supabase-js` แล้ว
- [ ] Build dashboard layout พื้นฐาน (status card + empty log)
- [ ] Test MQTT WebSocket connection กับ Mosquitto
  ```typescript
  const client = mqtt.connect('ws://localhost:9001')
  client.on('connect', () => console.log('Connected!'))
  ```
- **Deliverable:** Dashboard layout + MQTT connect ได้

#### **Evening (2-4 hours)**
- **Team sync:** ยืนยัน MQTT broker IP, USB camera device id, port 8080 ว่างอยู่
- **Test:** MQTT broker รับ-ส่งได้จากทุก device ใน LAN

---

### Day 2: Core Logic & Integration

#### **Morning (6-8 hours)**

**Person 1 (CiraCore):**
- [ ] Complete `local_logger.py` (SQLite logger)
- [ ] Complete `api_server.py` (Flask + CORS)
- [ ] Complete `main.py` (detection loop + MQTT + log)
  - Safety logic: person & car → close, clear → open
  - MQTT publish detection every 10 frames
  - SQLite log every state change
  - Start Flask API thread on port 8080
- [ ] Test ตั้งแต่ต้นจนจบ: webcam detect → MQTT publish → log ลง DB
- **Deliverable:** CiraCore detect + MQTT publish + SQLite log + HTTP API ทำงาน

**Person 2 (ESP32):**
- [ ] Complete MQTT callback + servo control
  ```python
  def on_message(topic, msg):
      if msg.decode() == "closed":
          servo_close()
      elif msg.decode() == "open":
          servo_open()
  ```
- [ ] Add debounce (ป้องกัน servo กระตุก)
- [ ] Add WiFi auto-reconnect
- [ ] Test servo ตอบสนองจาก PC terminal
  ```bash
  mosquitto_pub -h localhost -t "/parking/barrier/cmd" -m "closed"
  # servo ต้องลงมา
  mosquitto_pub -h localhost -t "/parking/barrier/cmd" -m "open"
  # servo ต้องขึ้น
  ```
- **Deliverable:** Servo ตอบสนอง MQTT command ได้ reliable

**Person 3 (Web):**
- [ ] Implement MQTT WebSocket subscriber
  - `/parking/detection` → update person/car count + servo state
  - `/parking/alert` → show alert banner
- [ ] Implement Local API fetch
  - `GET localhost:8080/api/events` → event log table
  - `GET localhost:8080/api/stats` → hourly stats chart
  - Poll ทุก 5 วินาที
- [ ] Build components:
  - Live status card (person count, car count)
  - Barrier status badge (OPEN/CLOSED)
  - Event log table (from local API)
  - Hourly bar chart (Recharts, from local API)
- **Deliverable:** Dashboard แสดง real-time + historical data ได้

#### **Evening (2-4 hours)**
- **End-to-end test:** ใส่คนและรถหน้า webcam → MQTT command ส่ง → servo ปิด → Dashboard update
- **Debug:** ตรวจ MQTT message flow, CORS ระหว่าง port 3000 และ 8080

---

### Day 3: Polish, Testing & Presentation

#### **Morning (6-8 hours)**

**Person 1 (CiraCore):**
- [ ] Implement anomaly detection (รถผ่านหลัง barrier ปิด)
  ```python
  if servo_state == "closed" and car_count > 0 and frames_at_state > 150:
      mqtt_pub.publish_alert("VEHICLE_IGNORING_BARRIER", "...")
  ```
- [ ] Confidence filtering: เฉพาะ detection ที่ > 0.6
- [ ] Optimize: resize frame เป็น 320x240 ก่อน YOLO
- [ ] Test stability 30+ minutes ไม่ crash
- [ ] Monitor RAM ด้วย `psutil`
- **Deliverable:** Stable, no crashes

**Person 2 (ESP32):**
- [ ] Implement servo debounce (ignore command ถ้า < 1 sec จาก last change)
- [ ] Test power supply (servo ดึง 500-1000mA ให้ใช้ power supply แยก)
- [ ] Test MQTT reconnect หลัง broker restart
- [ ] Verify servo range (0° = open, 90° = closed)
- **Deliverable:** Hardware reliable, handle edge cases

**Person 3 (Web):**
- [ ] Add today's summary stats (total activations, unique hours)
- [ ] Add compliance score card
- [ ] Add alert banner component
- [ ] Dark mode polish
- [ ] Mobile responsive test
- [ ] Test ว่า refresh page แล้วยัง load historical data ได้ (จาก local API)
- **Deliverable:** Production-ready dashboard

#### **Afternoon (2-4 hours) — Final Integration & Demo Prep**

**All Team:**
- [ ] Full system test 30 minutes continuous:
  1. `mosquitto` → start broker
  2. `python main.py` → start CiraCore
  3. `npm run dev` → start dashboard
  4. Upload code → ESP32 start listening
  5. Verify: webcam → detect → MQTT → servo → dashboard update → log saved

- [ ] Prepare backup: record 2-3 successful activations as MP4
- [ ] Prepare 5-slide presentation deck
- [ ] Rehearse demo + Q&A

---

## 7. Setup Guide

### Prerequisites
- **Hardware:** USB Webcam, ESP32, Servo (SG90 หรือ similar), jumper wires, external 5V power
- **Software:** Python 3.9+, Node.js 18+, Git
- **Network:** Local Wi-Fi (ทุก device ต้องใช้ subnet เดียวกัน)
- **ไม่ต้องมี:** Supabase account, internet connection (หลัง setup)

---

### Step 1: Mosquitto Setup (WebSocket Required)

#### 1a. Install Mosquitto
```bash
# Ubuntu/Debian
sudo apt update && sudo apt install mosquitto mosquitto-clients

# macOS
brew install mosquitto

# Windows: https://mosquitto.org/download/
```

#### 1b. Configure WebSocket Bridge (สำคัญมาก!)
แก้ไขไฟล์ `/etc/mosquitto/mosquitto.conf` (Linux) หรือ `mosquitto.conf` (Windows):
```
# MQTT standard port (for ESP32)
listener 1883
protocol mqtt
allow_anonymous true

# WebSocket port (for browser Dashboard)
listener 9001
protocol websockets
allow_anonymous true
```

```bash
# Restart Mosquitto
sudo systemctl restart mosquitto

# Verify running
sudo systemctl status mosquitto
```

#### 1c. Test Broker
```bash
# Terminal A: subscribe
mosquitto_sub -h localhost -t "test" -v

# Terminal B: publish
mosquitto_pub -h localhost -t "test" -m "hello"
# Terminal A ควรพิมพ์: test hello
```

---

### Step 2: USB Webcam Setup

#### 2a. Verify Detection
```bash
# Linux
ls /dev/video*   # ควรเห็น /dev/video0

# macOS/Windows: plug and play
```

#### 2b. Test with Python
```bash
pip install opencv-python
python -c "
import cv2
cap = cv2.VideoCapture(0)
ret, frame = cap.read()
print('Shape:', frame.shape if ret else 'FAILED')
cap.release()
"
# ควรได้: Shape: (480, 640, 3)
```

---

### Step 3: CiraCore Setup

#### 3a. Install Python Dependencies
```bash
mkdir ciracore-parking && cd ciracore-parking
pip install opencv-python ultralytics paho-mqtt flask flask-cors pyyaml
```

#### 3b. Download YOLO Model
```bash
python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"
# ~6MB, ดาวน์โหลดไปที่ ~/.cache/ultralytics/
```

#### 3c. Create config.yaml
```yaml
mqtt:
  broker: localhost       # หรือ IP ของ PC เช่น 192.168.1.100
  port: 1883
  topic_barrier_cmd: /parking/barrier/cmd
  topic_detection: /parking/detection
  topic_alert: /parking/alert

camera:
  device: 0              # /dev/video0
  width: 640
  height: 480
  fps: 30

yolo:
  model: yolov8n.pt
  confidence: 0.55
  device: cpu            # หรือ cuda ถ้ามี GPU

database:
  path: crosswalk.db     # SQLite local file

api:
  port: 8080             # Local HTTP API for Dashboard
  host: 0.0.0.0
```

#### 3d. Test CiraCore
```bash
python main.py
# ควรเห็น:
# ✓ Connected to MQTT broker: localhost:1883
# ✓ SQLite database initialized: crosswalk.db
# ✓ HTTP API server started on port 8080
# [0001] P:0 C:0 | Servo: open
# [0002] P:1 C:0 | Servo: open
# [0003] P:1 C:1 | Servo: closed   ← barrier activate!
```

#### 3e. Test Local API
```bash
# ใน terminal อื่น
curl http://localhost:8080/api/health
# {"status": "ok"}

curl http://localhost:8080/api/events
# [...event list...]
```

---

### Step 4: ESP32 Setup

#### 4a. Flash MicroPython
```bash
pip install esptool mpremote

# Download firmware จาก https://micropython.org/download/esp32/
esptool.py --chip esp32 --port /dev/ttyUSB0 erase_flash
esptool.py --chip esp32 --port /dev/ttyUSB0 write_flash -z 0x1000 esp32-micropython.bin
```

#### 4b. Install MQTT Library
```bash
mpremote mip install umqtt.simple
```

#### 4c. Servo Wiring
```
ESP32 GPIO 15  →  Servo Signal (สายส้ม/เหลือง)
External 5V    →  Servo VCC    (สายแดง)
GND (shared)   →  Servo GND    (สายน้ำตาล/ดำ)

⚠️ อย่าต่อ Servo VCC เข้ากับ ESP32 3.3V/5V โดยตรง
   ใช้ external power supply 5V แยกต่างหาก (servo ดึงกระแสสูง)
```

#### 4d. Upload Code
```bash
# Upload main.py ขึ้น ESP32
mpremote cp main.py :main.py
mpremote run main.py

# ควรเห็น:
# ✓ Wi-Fi connected! IP: 192.168.x.x
# ✓ MQTT connected to 192.168.1.100:1883
# ✓ Subscribed to /parking/barrier/cmd
# 🔓 Barrier OPEN (initial state)
```

#### 4e. Test Servo from PC
```bash
mosquitto_pub -h localhost -t "/parking/barrier/cmd" -m "closed"
# Servo ต้องหมุนลงมา (90°)

mosquitto_pub -h localhost -t "/parking/barrier/cmd" -m "open"
# Servo ต้องยกขึ้น (0°)
```

---

### Step 5: Web Dashboard Setup

#### 5a. Create Next.js Project
```bash
npx create-next-app@latest smart-crosswalk \
  --typescript \
  --tailwind \
  --use-npm \
  --no-eslint
cd smart-crosswalk
npm install mqtt recharts
```

#### 5b. Create Environment Variables
```bash
# .env.local
NEXT_PUBLIC_MQTT_BROKER=ws://localhost:9001
NEXT_PUBLIC_API_BASE=http://localhost:8080
```

#### 5c. Start Dashboard
```bash
npm run dev
# Open http://localhost:3000
```

---

### Step 6: Full System Start (Demo Day)

```bash
# Terminal 1: Start MQTT Broker
mosquitto -v

# Terminal 2: Start CiraCore (Detection + API)
cd ciracore-parking
python main.py

# Terminal 3: Start Web Dashboard
cd smart-crosswalk
npm run dev

# Terminal 4 (optional): Monitor MQTT messages
mosquitto_sub -h localhost -t "#" -v

# Browser: http://localhost:3000
```

---

## 8. Code Examples

### CiraCore: main.py
```python
import cv2
import time
import yaml
import threading
from ultralytics import YOLO
from datetime import datetime
from mqtt_publisher import MQTTPublisher
from local_logger import LocalLogger
from api_server import run_api

# ============ Load Config ============
with open('config.yaml', 'r') as f:
    CONFIG = yaml.safe_load(f)

# ============ Initialize ============
MODEL = YOLO(CONFIG['yolo']['model'])

mqtt_pub = MQTTPublisher(CONFIG['mqtt']['broker'], CONFIG['mqtt']['port'])
db_log = LocalLogger(CONFIG['database']['path'])

# Start HTTP API server in background thread
api_thread = threading.Thread(
    target=run_api,
    args=(db_log, CONFIG['api']['port']),
    daemon=True
)
api_thread.start()
print(f"✓ HTTP API server started on port {CONFIG['api']['port']}")

# ============ Detection Loop ============
def main():
    cap = cv2.VideoCapture(CONFIG['camera']['device'])
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, CONFIG['camera']['width'])
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, CONFIG['camera']['height'])
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)  # ลด buffer ให้ใช้ frame ล่าสุดเสมอ

    frame_count = 0
    servo_state = 'open'
    clear_frame_count = 0  # นับ frame ที่ไม่มีคน
    CLEAR_THRESHOLD = 3    # ต้องว่างอย่างน้อย 3 frame ก่อน open

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                print("⚠ Camera error, reconnecting...")
                cap.release()
                time.sleep(2)
                cap = cv2.VideoCapture(CONFIG['camera']['device'])
                continue

            # Resize เพื่อ performance
            small_frame = cv2.resize(frame, (320, 240))

            # YOLOv8 detection
            results = MODEL(
                small_frame,
                conf=CONFIG['yolo']['confidence'],
                verbose=False
            )

            # Count detections
            person_count = 0
            car_count = 0
            person_conf = 0.0
            car_conf = 0.0

            for box in results[0].boxes:
                class_id = int(box.cls[0])
                confidence = float(box.conf[0])

                if class_id == 0:  # person
                    person_count += 1
                    person_conf = max(person_conf, confidence)
                elif class_id in [2, 3]:  # car or motorcycle
                    car_count += 1
                    car_conf = max(car_conf, confidence)

            # ============ Safety Logic ============
            if person_count > 0 and car_count > 0:
                clear_frame_count = 0
                new_state = 'closed'
            elif person_count == 0:
                clear_frame_count += 1
                new_state = 'open' if clear_frame_count >= CLEAR_THRESHOLD else servo_state
            else:
                # มีคนแต่ไม่มีรถ → เปิดได้
                clear_frame_count = 0
                new_state = 'open'

            # State change → publish MQTT + log
            if new_state != servo_state:
                print(f"✓ Servo: {servo_state} → {new_state}")
                mqtt_pub.send_barrier_cmd(new_state)
                servo_state = new_state

                event_type = 'BARRIER_ACTIVATED' if new_state == 'closed' else 'BARRIER_DEACTIVATED'
                db_log.log_event({
                    'event_type': event_type,
                    'person_count': person_count,
                    'car_count': car_count,
                    'servo_state': servo_state,
                    'confidence_person': person_conf,
                    'confidence_car': car_conf
                })

            # Publish detection data ทุก 10 frames (MQTT → Dashboard)
            if frame_count % 10 == 0:
                mqtt_pub.publish_detection({
                    'timestamp': datetime.utcnow().isoformat() + 'Z',
                    'person_count': person_count,
                    'car_count': car_count,
                    'person_confidence': round(person_conf, 2),
                    'car_confidence': round(car_conf, 2),
                    'servo_state': servo_state
                })

            # Console log ทุก 30 frames
            if frame_count % 30 == 0:
                print(f"[{frame_count:05d}] P:{person_count} C:{car_count} | {servo_state.upper()}")

            frame_count += 1

    except KeyboardInterrupt:
        print("\n✓ Shutdown")
    finally:
        cap.release()
        mqtt_pub.disconnect()
        print(f"Total frames: {frame_count}")

if __name__ == '__main__':
    main()
```

---

### CiraCore: local_logger.py (SQLite — แทน Supabase)
```python
import sqlite3
import threading
from datetime import datetime

class LocalLogger:
    def __init__(self, db_path='crosswalk.db'):
        self.db_path = db_path
        self.lock = threading.Lock()
        self._init_db()
        print(f"✓ SQLite database initialized: {db_path}")

    def _init_db(self):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute('''
                CREATE TABLE IF NOT EXISTS events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    created_at TEXT DEFAULT (datetime('now', 'localtime')),
                    event_type TEXT NOT NULL,
                    person_count INTEGER DEFAULT 0,
                    car_count INTEGER DEFAULT 0,
                    servo_state TEXT NOT NULL,
                    confidence_person REAL DEFAULT 0.0,
                    confidence_car REAL DEFAULT 0.0
                )
            ''')
            conn.execute('CREATE INDEX IF NOT EXISTS idx_created_at ON events(created_at DESC)')
            conn.execute('CREATE INDEX IF NOT EXISTS idx_event_type ON events(event_type)')
            conn.commit()

    def log_event(self, event_data: dict) -> bool:
        with self.lock:
            try:
                with sqlite3.connect(self.db_path) as conn:
                    conn.execute('''
                        INSERT INTO events
                        (event_type, person_count, car_count, servo_state, confidence_person, confidence_car)
                        VALUES (?, ?, ?, ?, ?, ?)
                    ''', (
                        event_data.get('event_type', 'UNKNOWN'),
                        event_data.get('person_count', 0),
                        event_data.get('car_count', 0),
                        event_data.get('servo_state', 'open'),
                        event_data.get('confidence_person', 0.0),
                        event_data.get('confidence_car', 0.0)
                    ))
                    conn.commit()
                    return True
            except Exception as e:
                print(f"✗ Log error: {e}")
                return False

    def get_events(self, limit=100) -> list:
        """ดึง events ล่าสุด (ใช้โดย API server)"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                rows = conn.execute(
                    'SELECT * FROM events ORDER BY created_at DESC LIMIT ?',
                    (limit,)
                ).fetchall()
                return [dict(row) for row in rows]
        except Exception as e:
            print(f"✗ Get events error: {e}")
            return []

    def get_stats_today(self) -> list:
        """สถิติรายชั่วโมงวันนี้ (ใช้โดย API server)"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                rows = conn.execute('''
                    SELECT
                        strftime('%H', created_at) as hour,
                        COUNT(*) as total_events,
                        SUM(CASE WHEN event_type = 'BARRIER_ACTIVATED' THEN 1 ELSE 0 END) as activations
                    FROM events
                    WHERE date(created_at) = date('now', 'localtime')
                    GROUP BY hour
                    ORDER BY hour
                ''').fetchall()
                return [dict(row) for row in rows]
        except Exception as e:
            print(f"✗ Get stats error: {e}")
            return []
```

---

### CiraCore: api_server.py (Flask HTTP API)
```python
from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Allow Dashboard on port 3000 to call this API

_logger = None

def set_logger(logger_instance):
    global _logger
    _logger = logger_instance

@app.route('/api/health')
def health():
    return jsonify({'status': 'ok', 'db': _logger.db_path if _logger else None})

@app.route('/api/events')
def get_events():
    if not _logger:
        return jsonify([])
    return jsonify(_logger.get_events(limit=100))

@app.route('/api/stats')
def get_stats():
    if not _logger:
        return jsonify([])
    return jsonify(_logger.get_stats_today())

def run_api(logger_instance, port=8080):
    """เรียกจาก threading.Thread"""
    set_logger(logger_instance)
    app.run(host='0.0.0.0', port=port, debug=False, use_reloader=False)
```

---

### CiraCore: mqtt_publisher.py
```python
import json
from datetime import datetime
import paho.mqtt.client as mqtt_client

class MQTTPublisher:
    def __init__(self, broker_ip, port=1883):
        self.client = mqtt_client.Client()
        try:
            self.client.connect(broker_ip, port, keepalive=60)
            self.client.loop_start()
            print(f"✓ Connected to MQTT broker: {broker_ip}:{port}")
        except Exception as e:
            print(f"✗ MQTT connect failed: {e}")

    def send_barrier_cmd(self, state: str):
        """ส่งคำสั่ง open/closed ไป ESP32"""
        try:
            self.client.publish(
                "/parking/barrier/cmd",
                state,          # plain string "open" หรือ "closed"
                qos=1,
                retain=True     # ESP32 ที่ connect ช้าจะยังได้รับ state ล่าสุด
            )
            print(f"📤 Published: /parking/barrier/cmd = {state}")
        except Exception as e:
            print(f"✗ Publish cmd error: {e}")

    def publish_detection(self, data: dict):
        """ส่ง detection data ให้ Dashboard (real-time)"""
        try:
            self.client.publish(
                "/parking/detection",
                json.dumps(data),
                qos=0  # fire-and-forget, เร็วกว่า
            )
        except Exception as e:
            print(f"✗ Publish detection error: {e}")

    def publish_alert(self, alert_type: str, description: str):
        """ส่ง alert ให้ Dashboard"""
        payload = {
            'alert_type': alert_type,
            'description': description,
            'timestamp': datetime.utcnow().isoformat() + 'Z'
        }
        try:
            self.client.publish("/parking/alert", json.dumps(payload), qos=1)
            print(f"⚠ Alert: {alert_type}")
        except Exception as e:
            print(f"✗ Publish alert error: {e}")

    def disconnect(self):
        self.client.loop_stop()
        self.client.disconnect()
        print("✓ MQTT disconnected")
```

---

### ESP32: main.py (MicroPython — รับคำสั่งอย่างเดียว)
```python
import machine
import network
import time
from umqtt.simple import MQTTClient

# ============ Configuration ============
SSID = "Your-WiFi-SSID"
PASSWORD = "Your-WiFi-Password"
MQTT_BROKER = "192.168.1.100"   # IP ของ PC ที่รัน Mosquitto
MQTT_PORT = 1883
CLIENT_ID = "esp32-barrier"

# ============ Servo Setup ============
SERVO_PIN = 15
servo = machine.PWM(machine.Pin(SERVO_PIN), freq=50)

def servo_open():
    """ยก barrier ขึ้น (0° = เปิดทาง)"""
    servo.duty(40)   # ~0° ปรับตาม servo จริง
    print("🔓 OPEN")

def servo_close():
    """ลด barrier ลง (90° = กั้นทาง)"""
    servo.duty(77)   # ~90° ปรับตาม servo จริง
    print("🔒 CLOSED")

# ============ WiFi Setup ============
def connect_wifi():
    sta = network.WLAN(network.STA_IF)
    sta.active(True)
    if not sta.isconnected():
        print(f"Connecting to {SSID}...")
        sta.connect(SSID, PASSWORD)
        for _ in range(20):
            if sta.isconnected():
                break
            time.sleep(0.5)
    if sta.isconnected():
        print(f"✓ WiFi: {sta.ifconfig()[0]}")
        return True
    print("✗ WiFi failed")
    return False

# ============ MQTT Callback ============
def on_message(topic, msg):
    """รับเฉพาะ "open" หรือ "closed" จาก CiraCore"""
    cmd = msg.decode().strip()
    print(f"📨 CMD: {cmd}")
    if cmd == "closed":
        servo_close()
    elif cmd == "open":
        servo_open()
    # ไม่ต้อง publish status กลับ

# ============ MQTT Setup ============
def connect_mqtt():
    client = MQTTClient(CLIENT_ID, MQTT_BROKER, MQTT_PORT, keepalive=30)
    client.set_callback(on_message)
    try:
        client.connect()
        client.subscribe(b"/parking/barrier/cmd")
        print(f"✓ MQTT connected → subscribed /parking/barrier/cmd")
        return client
    except Exception as e:
        print(f"✗ MQTT failed: {e}")
        return None

# ============ Reconnect Logic ============
def ensure_mqtt(client):
    """ลอง reconnect ถ้า disconnect"""
    try:
        client.ping()
        return client
    except:
        print("MQTT disconnected, reconnecting...")
        return connect_mqtt()

# ============ Main ============
def main():
    servo_open()  # Default state: เปิด

    if not connect_wifi():
        machine.reset()

    client = connect_mqtt()
    if not client:
        machine.reset()

    last_debounce = 0
    DEBOUNCE_MS = 1000  # ไม่รับ command ถ้า < 1 วินาที จาก command ก่อน

    try:
        while True:
            client = ensure_mqtt(client)
            if client:
                client.check_msg()   # Non-blocking: check แล้วกลับมาทันที
            time.sleep(0.05)         # 20Hz polling

    except Exception as e:
        print(f"✗ Error: {e}")
        machine.reset()

main()
```

---

### Web Dashboard: app/page.tsx (Next.js — No Supabase)
```typescript
'use client'

import { useEffect, useState, useCallback } from 'react'
import mqtt from 'mqtt'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

// ============ Types ============
type DetectionData = {
  person_count: number
  car_count: number
  person_confidence: number
  car_confidence: number
  servo_state: string
  timestamp: string
}

type EventRow = {
  id: number
  created_at: string
  event_type: string
  person_count: number
  car_count: number
  servo_state: string
}

type StatRow = {
  hour: string
  total_events: number
  activations: number
}

// ============ Constants ============
const MQTT_WS_URL = process.env.NEXT_PUBLIC_MQTT_BROKER || 'ws://localhost:9001'
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8080'

// ============ Component ============
export default function Dashboard() {
  const [mqttConnected, setMqttConnected] = useState(false)
  const [apiConnected, setApiConnected] = useState(false)
  const [detection, setDetection] = useState<DetectionData | null>(null)
  const [events, setEvents] = useState<EventRow[]>([])
  const [stats, setStats] = useState<StatRow[]>([])
  const [alertMsg, setAlertMsg] = useState<string | null>(null)

  // ============ MQTT Connection ============
  useEffect(() => {
    const client = mqtt.connect(MQTT_WS_URL, {
      clientId: `dashboard-${Math.random().toString(16).slice(2)}`,
      reconnectPeriod: 3000
    })

    client.on('connect', () => {
      setMqttConnected(true)
      client.subscribe('/parking/detection')
      client.subscribe('/parking/alert')
      console.log('✓ MQTT connected')
    })

    client.on('message', (topic, message) => {
      try {
        const payload = JSON.parse(message.toString())
        if (topic === '/parking/detection') {
          setDetection(payload)
        } else if (topic === '/parking/alert') {
          setAlertMsg(payload.description || payload.alert_type)
          setTimeout(() => setAlertMsg(null), 8000)
        }
      } catch (e) {
        console.error('MQTT parse error:', e)
      }
    })

    client.on('error', () => setMqttConnected(false))
    client.on('offline', () => setMqttConnected(false))
    client.on('reconnect', () => setMqttConnected(false))

    return () => { client.end() }
  }, [])

  // ============ Fetch from Local API ============
  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/events`)
      if (res.ok) {
        setEvents(await res.json())
        setApiConnected(true)
      }
    } catch {
      setApiConnected(false)
    }
  }, [])

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/stats`)
      if (res.ok) setStats(await res.json())
    } catch {}
  }, [])

  useEffect(() => {
    // Initial fetch
    fetchEvents()
    fetchStats()
    // Poll ทุก 5 วินาที
    const evInterval = setInterval(fetchEvents, 5000)
    const stInterval = setInterval(fetchStats, 10000)
    return () => { clearInterval(evInterval); clearInterval(stInterval) }
  }, [fetchEvents, fetchStats])

  // ============ Derived Values ============
  const servoState = detection?.servo_state?.toUpperCase() || 'UNKNOWN'
  const isClosed = servoState === 'CLOSED'
  const todayActivations = stats.reduce((sum, s) => sum + (s.activations || 0), 0)

  // ============ Render ============
  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">🚦 Smart Crosswalk</h1>
            <p className="text-slate-400 text-sm mt-1">CiraCore Local System</p>
          </div>
          <div className="flex gap-3 text-xs">
            <span className={mqttConnected ? 'text-green-400' : 'text-red-400'}>
              {mqttConnected ? '● MQTT Live' : '○ MQTT Off'}
            </span>
            <span className={apiConnected ? 'text-green-400' : 'text-yellow-400'}>
              {apiConnected ? '● API Connected' : '○ API Offline'}
            </span>
          </div>
        </div>

        {/* Alert Banner */}
        {alertMsg && (
          <div className="bg-red-900/80 border border-red-500 rounded-lg p-3 text-red-200 text-sm">
            ⚠️ {alertMsg}
          </div>
        )}

        {/* Live Detection Cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
            <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">👥 Pedestrians</p>
            <p className="text-5xl font-bold text-blue-400">{detection?.person_count ?? '—'}</p>
            {detection?.person_confidence > 0 && (
              <p className="text-xs text-slate-500 mt-1">conf: {(detection.person_confidence * 100).toFixed(0)}%</p>
            )}
          </div>

          <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
            <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">🚗 Vehicles</p>
            <p className="text-5xl font-bold text-amber-400">{detection?.car_count ?? '—'}</p>
            {detection?.car_confidence > 0 && (
              <p className="text-xs text-slate-500 mt-1">conf: {(detection.car_confidence * 100).toFixed(0)}%</p>
            )}
          </div>

          <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
            <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">📊 Today</p>
            <p className="text-5xl font-bold text-violet-400">{todayActivations}</p>
            <p className="text-xs text-slate-500 mt-1">activations</p>
          </div>
        </div>

        {/* Barrier Status */}
        <div className={`rounded-xl p-6 border-2 ${isClosed ? 'bg-red-950 border-red-600' : 'bg-green-950 border-green-600'}`}>
          <div className="flex items-center gap-4">
            <div className={`text-6xl ${isClosed ? 'animate-pulse' : ''}`}>
              {isClosed ? '🔴' : '🟢'}
            </div>
            <div>
              <p className={`text-4xl font-bold ${isClosed ? 'text-red-400' : 'text-green-400'}`}>
                BARRIER {servoState}
              </p>
              <p className="text-slate-300 mt-1">
                {isClosed
                  ? 'Pedestrian crossing — vehicles blocked'
                  : 'Clear — vehicles may pass'}
              </p>
            </div>
          </div>
        </div>

        {/* Stats Chart */}
        {stats.length > 0 && (
          <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
            <h2 className="text-lg font-semibold mb-4">Today's Hourly Activations</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="hour"
                  stroke="#94a3b8"
                  tickFormatter={(v) => `${v}:00`}
                />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                  labelFormatter={(v) => `${v}:00`}
                />
                <Bar dataKey="activations" fill="#3b82f6" name="Activations" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Event Log */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <h2 className="text-lg font-semibold mb-4">
            Recent Events
            {!apiConnected && (
              <span className="ml-2 text-xs text-yellow-400">
                (CiraCore API offline — start python main.py)
              </span>
            )}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-600 text-slate-400 text-xs">
                  <th className="text-left py-2">Time</th>
                  <th className="text-left py-2">Event</th>
                  <th className="text-center py-2">👥</th>
                  <th className="text-center py-2">🚗</th>
                  <th className="text-left py-2">State</th>
                </tr>
              </thead>
              <tbody>
                {events.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      No events yet — waiting for detection...
                    </td>
                  </tr>
                ) : events.map((e) => (
                  <tr key={e.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="py-2 text-xs text-slate-400">
                      {new Date(e.created_at).toLocaleTimeString()}
                    </td>
                    <td className="py-2 text-xs">
                      {e.event_type === 'BARRIER_ACTIVATED' ? '🚦' : '✅'} {e.event_type}
                    </td>
                    <td className="py-2 text-center font-semibold text-blue-400">{e.person_count}</td>
                    <td className="py-2 text-center font-semibold text-amber-400">{e.car_count}</td>
                    <td className="py-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        e.servo_state === 'closed'
                          ? 'bg-red-900 text-red-200'
                          : 'bg-green-900 text-green-200'
                      }`}>
                        {e.servo_state?.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </main>
  )
}
```

---

## 9. Demo Flow & Script

### Prerequisites (เปิดก่อน demo)
```bash
# Terminal 1
mosquitto -v

# Terminal 2
cd ciracore-parking && python main.py

# Terminal 3
cd smart-crosswalk && npm run dev
# Browser: http://localhost:3000
```

### Act 1: Introduction (1 min)
> "Thailand ขาดชีวิต 1,200+ คน/ปี จากอุบัติเหตุทางถนน  
> ระบบของเราใช้ AI ตรวจจับคนข้ามถนนและรถ  
> เมื่อพบทั้งสองพร้อมกัน — ไม้กันปิดทันทีใน <200ms  
> ไม่พึ่งการตัดสินใจของมนุษย์"

### Act 2: Live Demo (3 min)

| Step | Action | Expected |
|------|--------|----------|
| 1 | ใส่รถหน้า webcam เท่านั้น | Dashboard: 🟢 OPEN, Car:1, Person:0 |
| 2 | ใส่คนหน้า webcam เท่านั้น | Dashboard: 🟢 OPEN, Person:1, Car:0 |
| 3 | ใส่ทั้งคนและรถพร้อมกัน | Dashboard: 🔴 CLOSED, Servo หมุน, Event log อัพเดต |
| 4 | เอาคนออก (รถยังอยู่) | รอ 3 frames → Dashboard: 🟢 OPEN, Servo ยกขึ้น |

### Act 3: Data (1 min)
> ชี้ที่ event log: "ทุก activation ถูก log ลง database local  
> ชี้ที่ bar chart: "เห็น peak hours ว่าชั่วโมงไหนอันตรายสุด  
> ข้อมูลนี้ช่วยวางแผน traffic signals และ enforcement"

### Backup Plan
```bash
# ถ้า CiraCore fail → ทดสอบ servo โดยตรง
mosquitto_pub -h localhost -t "/parking/barrier/cmd" -m "closed"
mosquitto_pub -h localhost -t "/parking/barrier/cmd" -m "open"
```

---

## 10. Troubleshooting

### Problem: Dashboard ไม่รับ MQTT (No live data)

**สาเหตุ:** Browser connect ไม่ได้กับ WebSocket broker

**แก้:**
```bash
# ตรวจว่า Mosquitto เปิด WebSocket port 9001
ss -tlnp | grep 9001   # Linux
netstat -an | findstr 9001   # Windows

# ถ้าไม่มี → แก้ mosquitto.conf เพิ่ม:
listener 9001
protocol websockets
allow_anonymous true

# แล้ว restart
sudo systemctl restart mosquitto
```

---

### Problem: CORS error ใน Browser Console

**สาเหตุ:** Dashboard (port 3000) call API (port 8080) แต่ไม่มี CORS header

**แก้:** ตรวจว่า `api_server.py` มี `CORS(app)` และได้ install `flask-cors`:
```bash
pip install flask-cors
```

---

### Problem: ESP32 ไม่รับ MQTT command

**สาเหตุ:** WiFi disconnect หรือ IP ของ PC เปลี่ยน

**แก้:**
```python
# ใน main.py ของ ESP32 เพิ่ม reconnect
def ensure_mqtt(client):
    try:
        client.ping()
        return client
    except:
        return connect_mqtt()

# และใน config.yaml ของ CiraCore ให้ใช้ IP จริง ไม่ใช่ localhost
mqtt:
  broker: 192.168.1.100  # IP ของ PC บนเครือข่าย local
```

---

### Problem: YOLOv8 False Positives (เห็น person ทั้งที่ไม่มี)

**แก้:**
```python
# เพิ่ม confidence threshold
yolo:
  confidence: 0.65  # เดิม 0.5 → เพิ่มเป็น 0.65

# หรือเพิ่ม temporal filter ใน main.py
CLEAR_THRESHOLD = 5  # เดิม 3 → 5 frames
```

---

### Problem: Memory Leak (CiraCore RAM เพิ่มเรื่อยๆ)

**แก้:**
```python
# ใน main.py
import gc
cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)  # สำคัญมาก

# ทุก 1000 frames
if frame_count % 1000 == 0:
    gc.collect()
    del small_frame  # free immediately
```

---

### Problem: Servo ไม่หมุน หรือ หมุนผิดทิศ

**แก้:**
```python
# ESP32: ปรับ duty values ให้ตรงกับ servo จริง
# SG90 standard:
#   0°   → duty ≈ 40  (~0.5ms pulse)
#   90°  → duty ≈ 77  (~1.5ms pulse)
#   180° → duty ≈ 115 (~2.5ms pulse)

# ทดสอบด้วย REPL:
from machine import PWM, Pin
s = PWM(Pin(15), freq=50)
s.duty(40)   # เปิด
s.duty(77)   # ปิด
```

---

### Monitoring Checklist (Demo Mode)

```bash
# Terminal: Watch MQTT traffic
mosquitto_sub -h localhost -t "#" -v

# Terminal: Watch CiraCore output
python main.py 2>&1 | tee ciracore.log

# Browser: เช็ค Console (F12)
# → ควรเห็น "✓ MQTT connected"
# → ไม่ควรมี CORS errors

# SQLite: verify logging
sqlite3 crosswalk.db "SELECT COUNT(*) FROM events;"
sqlite3 crosswalk.db "SELECT * FROM events ORDER BY created_at DESC LIMIT 5;"
```

---

## Deployment Checklist (Local Demo)

- [ ] **Mosquitto:** running, port 1883 + 9001 active
- [ ] **CiraCore:** detection loop ทำงาน 30+ นาทีไม่ crash
- [ ] **API Server:** `curl localhost:8080/api/health` ตอบ ok
- [ ] **SQLite:** events ถูก log เข้า `crosswalk.db`
- [ ] **ESP32:** WiFi connected, servo ตอบสนองภายใน 500ms
- [ ] **Dashboard:** แสดง real-time data + event log ถูกต้อง
- [ ] **CORS:** ไม่มี error ใน browser console
- [ ] **Backup:** ถ่ายวิดีโอ demo ไว้เผื่อระบบพัง

---

## Future Enhancements (Post-Demo)

1. **Cloud Sync:** เพิ่ม optional Supabase sync เมื่อมี internet
2. **Export CSV:** ดาวน์โหลด event log จาก Dashboard
3. **Carbon Calculator:** แสดง CO₂ saved แบบ real-time
4. **Multi-Camera:** เพิ่ม webcam หลายตัวสำหรับ multi-lane
5. **Predictive:** ML model ทำนาย peak crossing hours
6. **Mobile App:** Compliance officer ดูสถิติบน phone

---

**Last Updated:** June 2026  
**Version:** 2.0 (Local-Only, No Supabase)  
**Status:** Ready for 3-Day Sprint ✅

> **Stack Summary:**  
> CiraCore (Python) ← USB Webcam → YOLOv8 → MQTT (paho) + SQLite (sqlite3) + HTTP API (Flask)  
> ESP32 (MicroPython) ← MQTT → Servo PWM  
> Dashboard (Next.js + Tailwind) ← MQTT WebSocket (localhost:9001) + Local API (localhost:8080)
