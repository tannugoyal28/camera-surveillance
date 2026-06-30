# Sentinel — Real-Time Camera Surveillance with Person Detection

A small Video Management System (VMS). Register cameras by RTSP URL, watch the
live feed in the browser with on-frame person detection, and receive real-time
alerts the moment a person appears. The entire system — frontend, backend,
detection worker, database, message queue, and a test camera source — comes up
with a single `docker compose up`.

---

## Table of contents
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Detection model](#detection-model)
- [Event format](#event-format)
- [How to run](#how-to-run)
- [API overview](#api-overview)
- [Project structure](#project-structure)
- [Design decisions](#design-decisions)
- [Bonuses implemented](#bonuses-implemented)
- [Future improvements](#future-improvements)

---

## Architecture

Six services run on one Docker network. Three are application code, three are
off-the-shelf infrastructure.

| Service    | Role |
|------------|------|
| `frontend` | React + TypeScript (Vite). Login, Dashboard, Cameras, Alerts pages. Live updates via WebSocket; live video via MJPEG. |
| `backend`  | Bun + Hono + Postgres. Auth, camera CRUD, start/stop control, alert storage with filtering + pagination, and the WebSocket. Consumes detection events from Redis. Never touches video. |
| `worker`   | Python. Reads each RTSP stream, runs YOLO person detection, draws boxes, streams annotated MJPEG to the browser, and publishes events to Redis. One independent thread per camera. |
| `postgres` | Persistent storage: users, cameras, alerts. |
| `redis`    | Message bus: commands (backend → worker) and detection events (worker → backend). |
| `mediamtx` | Serves a looping sample video as a fake RTSP camera, so no physical camera is needed. |

### Three independent data paths

The key architectural idea is that the three kinds of traffic travel on
separate paths — in particular, **video never passes through the API or the
database**.

``` REST + WebSocket
Browser  <───────────────────────>  Backend  ──SQL──>  Postgres
│                                    │
│                            Redis (message bus)
│                       commands ↓        ↑ events
│                                    │
└─────────── MJPEG video ────────  Worker  ──RTSP──>  MediaMTX
```

1. **Control / data** — REST (login, CRUD, start/stop) and a WebSocket (live
   alerts + stats) between browser and backend.
2. **Commands / events** — Redis carries start/stop commands to the worker and
   detection events back to the backend. The backend and worker are fully
   decoupled; neither calls the other directly.
3. **Video** — the worker serves annotated MJPEG straight to the browser,
   keeping heavy video traffic off the API and DB entirely.

### Request lifecycle (clicking "Start")

`Browser → POST /api/cameras/:id/start → Backend publishes to Redis →
Worker picks up the command, opens the RTSP stream, runs detection →
Worker publishes status/stats/detection events to Redis →
Backend stores detections and broadcasts all events over the WebSocket →
Browser updates the tile (badge, FPS, alerts) live.`

---

## Tech stack

- **Frontend:** React 18, TypeScript, Vite, SCSS, React Router. JWT stored
  client-side; a single WebSocket drives all live updates.
- **Backend:** Bun runtime, Hono web framework, Postgres (via `postgres.js`),
  Redis (via `ioredis`). JWT auth (HS256), password hashing via `Bun.password`.
- **Worker:** Python 3.12, OpenCV (RTSP ingest + drawing), Ultralytics YOLO
  (detection), Flask (MJPEG streaming), `redis` client.
- **Infrastructure:** Postgres 16, Redis 7, MediaMTX (RTSP test source),
  Docker Compose.

---

## Detection model

**Ultralytics YOLO11n (the "nano" variant).**

Why this model:
- **Open source** and trivial to use — loading and inference is two lines.
- **Runs in real time on CPU.** The nano variant is the smallest YOLO11 model,
  so no GPU is required to keep up with the stream.
- **Person detection is built in.** It's trained on COCO, where class `0` is
  `person`, so detecting people needs no fine-tuning — we simply filter to
  class 0 above a confidence threshold (0.5).
- **No runtime download.** The weights are baked into the worker image at build
  time, so the container starts detecting immediately.

To balance CPU load against latency, detection runs on **every 3rd frame**;
the most recent bounding boxes are drawn on every frame so the video stays
smooth.

---

## Event format

A single event contract is used identically across the worker, Redis, the
backend, the database, and the WebSocket payload. Every message is JSON with a
`type` discriminator. There are three types:

```jsonc
// A person was detected. Persisted as a row in the "alerts" table.
{
  "type": "detection",
  "camera_id": "f8bc89e3-f20f-4baf-aff4-a1bf5a26ce6d",
  "label": "person",
  "count": 3,                 // number of people in the frame
  "confidence": 0.91,         // highest-confidence detection
  "bbox": [595.5, 255.5, 639.7, 352.1],  // [x1, y1, x2, y2] of the top box
  "ts": "2026-06-30T06:53:32.694177+00:00"
}

// Periodic per-camera statistics (every 5s). Forwarded live, not stored.
{
  "type": "stats",
  "camera_id": "f8bc89e3-f20f-4baf-aff4-a1bf5a26ce6d",
  "fps": 18.4,
  "detections_per_min": 207,
  "state": "live",
  "ts": "2026-06-30T06:53:37.934517+00:00"
}

// Lifecycle state change. Forwarded live, not stored.
{
  "type": "status",
  "camera_id": "f8bc89e3-f20f-4baf-aff4-a1bf5a26ce6d",
  "state": "connecting | live | stopped | error",
  "message": "optional error detail",   // present only on "error"
  "ts": "2026-06-30T06:53:24.987966+00:00"
}
```

Only `detection` events are written to the database. All three types are pushed
to the owning user's browser over the WebSocket so the dashboard updates live.

---

## How to run

**Requirements:** Docker and Docker Compose.

1. **Create `.env`** at the project root (a `.env.example` is included):

```env
   POSTGRES_USER=surveil
   POSTGRES_PASSWORD=devpassword
   POSTGRES_DB=surveillance
   JWT_SECRET=replace-with-a-long-random-string
```

2. **Add a sample video** containing people at `media/sample.avi`:

```bash
   curl -L -o media/sample.avi \
     https://raw.githubusercontent.com/opencv/opencv/master/samples/data/vtest.avi
```

3. **Bring everything up:**

```bash
   docker compose up -d --build
```

   The first build downloads PyTorch/Ultralytics for the worker image, which can
   take a few minutes depending on connection speed. Subsequent starts are fast.

4. **Use the app:** open <http://localhost:5173>.
   - Click **Sign up** and create an account.
   - On the **Cameras** page, add a camera with RTSP URL
     `rtsp://mediamtx:8554/cam1`.
   - On the **Dashboard**, click **Start** — the live feed appears with green
     boxes around detected people, FPS and detections-per-minute update live,
     and alerts begin streaming.
   - The **Alerts** page shows the full detection history with filtering by
     camera and time range, plus pagination.

**Useful URLs / ports:**
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3000`
- Worker MJPEG/health: `http://localhost:8000/health`

**Tear down:** `docker compose down` (add `-v` to also wipe the database volume).

---

## API overview

All `/api/*` routes require an `Authorization: Bearer <jwt>` header.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/signup` | Create an account, returns a JWT |
| POST | `/auth/login` | Log in, returns a JWT |
| GET | `/api/cameras` | List the user's cameras |
| POST | `/api/cameras` | Create a camera |
| GET | `/api/cameras/:id` | Get one camera |
| PATCH | `/api/cameras/:id` | Update a camera |
| DELETE | `/api/cameras/:id` | Delete a camera |
| POST | `/api/cameras/:id/start` | Start processing (publishes a command) |
| POST | `/api/cameras/:id/stop` | Stop processing |
| GET | `/api/alerts` | List alerts; filters: `camera_id`, `from`, `to`; pagination: `limit`, `offset` |
| GET | `/ws?token=<jwt>` | WebSocket for live alerts and stats |

---

## Project structure

The key architectural idea is that the three kinds of traffic travel on
separate paths — in particular, **video never passes through the API or the
database**.

```
camera-surveillance/
├── docker-compose.yml        # orchestrates all six services
├── .env / .env.example       # secrets and config
├── mediamtx.yml              # fake RTSP camera config
├── media/sample.avi          # looping test video
├── backend/                  # Bun + Hono + Postgres
│   └── src/{index,db,auth,cameras,alerts,control,events,realtime}.ts
├── worker/                   # Python detection + MJPEG worker
│   └── main.py
└── frontend/                 # React + TypeScript
└── src/{pages,components,hooks,auth,api,styles}
```

---

## Design decisions

- **Message queue between backend and worker.** The backend publishes commands
  to Redis and the worker subscribes; events flow back the same way. This
  decouples the two services — the backend has no idea how many workers exist —
  which is the foundation for horizontal scaling.

- **Independent per-camera pipelines.** Each camera runs in its own worker
  thread with its own stop signal. A failing or stopped stream publishes an
  `error`/`stopped` status and ends without affecting any other camera.

- **One canonical event format.** A single JSON shape with a `type` field is
  used everywhere, so there is no translation layer between worker, queue, API,
  DB, and WebSocket.

- **Video kept off the API path.** The worker serves video directly via MJPEG,
  so constant high-bandwidth video traffic never touches the JSON API or the
  database.

- **Alert dedup / rate limiting at the source.** YOLO detects a person in nearly
  every frame; a per-camera cooldown collapses this into at most one stored
  alert per 10 seconds, keeping the alert stream meaningful instead of noisy.

- **User scoping enforced in the database.** Every camera and alert query filters
  by the authenticated user's id, so users can only ever see and control their
  own cameras.

---

## Bonuses implemented

- **Message queue** for camera commands and detection events (Redis pub/sub).
- **Alert deduplication + rate limiting** (per-camera cooldown).
- **Scalable architecture (by design):** the stateless command queue plus
  isolated per-camera pipelines mean multiple worker replicas can run and share
  the load via Redis with no backend changes.

---

## Future improvements

- **WebRTC video.** The live view currently uses annotated MJPEG, chosen for
  reliability and simplicity. The intended upgrade is WebRTC for lower latency
  and better scaling under many viewers.
- **Tests.** Unit tests for auth and the event contract, plus an integration
  test for the full command → detection → stored-alert round trip.
- **Kubernetes.** Manifests per service (Deployments/Services, a StatefulSet for
  Postgres, Redis, an Ingress) to run on a cluster and scale the worker
  Deployment horizontally.
- **Production hardening.** Replace Flask's development server with a production
  WSGI server (gunicorn); use short-lived WebSocket tickets instead of a token
  query parameter; add refresh tokens; replace on-boot schema creation with
  versioned database migrations.
- **Stream management.** Cap concurrent MJPEG connections and tear down idle
  streams to bound resource use as camera counts grow.

  ## Current Project Demo Video Link
  <https://drive.google.com/file/d/1b08YNMtup7rfDnWyn9kurXCQfCUjsq_R/view?usp=sharing>
