# FastAPI service - API plus the compiled single-page app when it is present.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip setuptools wheel \
    && pip install --no-cache-dir -r requirements.txt

COPY . .

ENV DATABASE_URL=sqlite:////data/harbour.db \
    SEED_ON_START=true \
    PORT=8000

RUN mkdir -p /data
VOLUME ["/data"]
EXPOSE 8000

# The schema is created and the demo harbour seeded by the application lifespan
# hook, so a bare container start is a complete, populated deployment.
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
