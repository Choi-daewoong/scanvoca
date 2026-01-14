#!/bin/sh
# Startup script for Cloud Run

# Use PORT environment variable provided by Cloud Run, default to 8080
PORT=${PORT:-8080}

echo "Starting uvicorn on port $PORT..."

# Start uvicorn with the PORT from environment
exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
