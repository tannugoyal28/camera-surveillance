FROM python:3.12-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 libxcb1 libgl1 && rm -rf /var/lib/apt/lists/*

# Install the CPU-only PyTorch first (much smaller than the default CUDA build).
# Long timeout + retries so a slow/flaky connection doesn't abort the download.
RUN pip install --no-cache-dir --timeout=1000 --retries=10 \
    torch torchvision --index-url https://download.pytorch.org/whl/cpu

COPY requirements.txt .
RUN for i in 1 2 3 4 5; do \
      pip install --no-cache-dir --timeout=1000 --retries=10 -r requirements.txt && break; \
      echo "retry $i..."; sleep 5; \
    done
RUN python -c "from ultralytics import YOLO; YOLO('yolo11n.pt')"
RUN pip install --no-cache-dir flask
COPY . .
CMD ["python", "-u", "main.py"]