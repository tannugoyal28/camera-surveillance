import os, json, time, threading
from datetime import datetime, timezone

import cv2
import redis
from ultralytics import YOLO
from flask import Flask, Response

REDIS_URL        = os.environ.get("REDIS_URL", "redis://redis:6379")
COMMANDS_CHANNEL = "camera:commands"
EVENTS_CHANNEL   = "camera:events"
PERSON_CLASS     = 0
CONF_THRESHOLD   = 0.5
DETECT_EVERY     = 3
ALERT_COOLDOWN   = 10
STATS_INTERVAL   = 5
JPEG_QUALITY     = 70

r = redis.from_url(REDIS_URL, decode_responses=True)
model = YOLO("yolo11n.pt")
print("[worker] model loaded", flush=True)

pipelines = {}
pipelines_lock = threading.Lock()
latest_frames = {}                 # camera_id -> jpeg bytes
frames_lock = threading.Lock()

def now_iso():
    return datetime.now(timezone.utc).isoformat()

def publish(event):
    r.publish(EVENTS_CHANNEL, json.dumps(event))

def run_pipeline(camera_id, rtsp_url, stop):
    try:
        publish({"type": "status", "camera_id": camera_id, "state": "connecting", "ts": now_iso()})
        cap = cv2.VideoCapture(rtsp_url)
        if not cap.isOpened():
            publish({"type": "status", "camera_id": camera_id, "state": "error",
                     "message": "could not open stream", "ts": now_iso()})
            return
        publish({"type": "status", "camera_id": camera_id, "state": "live", "ts": now_iso()})

        frame_count = 0
        detections_window = []
        last_alert_at = 0.0
        last_stats_at = time.time()
        fps_counter, fps_timer, current_fps = 0, time.time(), 0.0
        last_boxes = []

        while not stop.is_set():
            ok, frame = cap.read()
            if not ok:
                cap.release(); time.sleep(1); cap = cv2.VideoCapture(rtsp_url); continue

            frame_count += 1; fps_counter += 1
            if time.time() - fps_timer >= 1.0:
                current_fps = fps_counter / (time.time() - fps_timer)
                fps_counter, fps_timer = 0, time.time()

            if frame_count % DETECT_EVERY == 0:
                results = model(frame, classes=[PERSON_CLASS], conf=CONF_THRESHOLD, verbose=False)
                boxes = results[0].boxes
                last_boxes = [tuple(map(int, b)) for b in boxes.xyxy.tolist()]
                count = len(last_boxes)
                if count > 0:
                    detections_window.append(time.time())
                    if time.time() - last_alert_at >= ALERT_COOLDOWN:
                        last_alert_at = time.time()
                        confs = boxes.conf.tolist()
                        top = max(confs)
                        bbox = boxes.xyxy.tolist()[confs.index(top)]
                        publish({"type": "detection", "camera_id": camera_id, "label": "person",
                                 "count": count, "confidence": round(top, 3),
                                 "bbox": [round(v, 1) for v in bbox], "ts": now_iso()})

            for (x1, y1, x2, y2) in last_boxes:
                cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 200, 0), 2)
            ok2, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
            if ok2:
                with frames_lock:
                    latest_frames[camera_id] = buf.tobytes()

            if time.time() - last_stats_at >= STATS_INTERVAL:
                last_stats_at = time.time()
                cutoff = time.time() - 60
                detections_window = [t for t in detections_window if t >= cutoff]
                publish({"type": "stats", "camera_id": camera_id, "fps": round(current_fps, 1),
                         "detections_per_min": len(detections_window), "state": "live", "ts": now_iso()})

        cap.release()
    except Exception as e:
        publish({"type": "status", "camera_id": camera_id, "state": "error", "message": str(e), "ts": now_iso()})
        print(f"[{camera_id}] crashed: {e}", flush=True)
    finally:
        with frames_lock:
            latest_frames.pop(camera_id, None)
        publish({"type": "status", "camera_id": camera_id, "state": "stopped", "ts": now_iso()})

def start_camera(camera_id, rtsp_url):
    with pipelines_lock:
        if camera_id in pipelines: return
        stop = threading.Event()
        t = threading.Thread(target=run_pipeline, args=(camera_id, rtsp_url, stop), daemon=True)
        pipelines[camera_id] = {"thread": t, "stop": stop}
        t.start()

def stop_camera(camera_id):
    with pipelines_lock:
        p = pipelines.pop(camera_id, None)
    if p: p["stop"].set()

app = Flask(__name__)

@app.route("/stream/<camera_id>")
def stream(camera_id):
    def gen():
        boundary = b"--frame\r\n"
        while True:
            with frames_lock:
                jpeg = latest_frames.get(camera_id)
            if jpeg is not None:
                yield boundary + b"Content-Type: image/jpeg\r\n\r\n" + jpeg + b"\r\n"
            time.sleep(0.04)
    return Response(gen(), mimetype="multipart/x-mixed-replace; boundary=frame")

@app.route("/health")
def health():
    return {"status": "ok"}

def main():
    threading.Thread(target=lambda: app.run(host="0.0.0.0", port=8000, threaded=True), daemon=True).start()
    print("[worker] MJPEG server on :8000", flush=True)
    pubsub = r.pubsub()
    pubsub.subscribe(COMMANDS_CHANNEL)
    print(f"[worker] listening on '{COMMANDS_CHANNEL}'", flush=True)
    for message in pubsub.listen():
        if message["type"] != "message": continue
        try: cmd = json.loads(message["data"])
        except json.JSONDecodeError: continue
        if cmd.get("action") == "start": start_camera(cmd.get("camera_id"), cmd.get("rtsp_url"))
        elif cmd.get("action") == "stop": stop_camera(cmd.get("camera_id"))

if __name__ == "__main__":
    main()