#!/bin/bash

# Start script for Railway deployment
echo "Starting DeepResearch API..."

# Check if PORT environment variable is set
if [ -z "$PORT" ]; then
    export PORT=8000
fi

echo "Using port: $PORT"

# Start the application
exec uvicorn main:app --host 0.0.0.0 --port $PORT --workers 1
