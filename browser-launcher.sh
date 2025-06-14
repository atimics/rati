#!/bin/bash

# Browser Launcher Service
# Waits for the frontend to be ready and automatically opens browser

set -e

echo "🌐 Browser Launcher Service Starting..."

# Wait for frontend to be ready
echo "⏳ Waiting for frontend service to be ready..."

# Function to check if frontend is accessible
check_frontend() {
  curl -s -f http://frontend:80 > /dev/null 2>&1
}

# Wait up to 60 seconds for frontend to be ready
TIMEOUT=60
COUNTER=0

while ! check_frontend; do
  sleep 2
  COUNTER=$((COUNTER + 2))
  
  if [ $COUNTER -ge $TIMEOUT ]; then
    echo "❌ Frontend did not become ready within ${TIMEOUT} seconds"
    exit 1
  fi
  
  echo "⏳ Still waiting for frontend... (${COUNTER}/${TIMEOUT}s)"
done

echo "✅ Frontend is ready!"

# Determine the host platform and open browser accordingly
if [ -f /.dockerenv ]; then
  # We're inside a Docker container
  echo "🐳 Running inside Docker container"
  echo "🌐 Frontend should be available at: http://localhost:3030"
  echo "💬 Chat interface ready!"
  
  # For Docker Desktop on Mac/Windows, we can try to open via the host
  if command -v xdg-open > /dev/null; then
    # Linux
    xdg-open "http://localhost:3030" 2>/dev/null || true
  elif command -v open > /dev/null; then
    # macOS
    open "http://localhost:3030" 2>/dev/null || true
  elif command -v start > /dev/null; then
    # Windows
    start "http://localhost:3030" 2>/dev/null || true
  fi
else
  echo "🖥️  Running on host system"
  
  # Direct host system commands
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    echo "🍎 Detected macOS - Opening Safari/default browser"
    open "http://localhost:3030"
  elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    echo "🐧 Detected Linux - Opening default browser"
    xdg-open "http://localhost:3030"
  elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    # Windows
    echo "🪟 Detected Windows - Opening default browser"
    start "http://localhost:3030"
  else
    echo "❓ Unknown OS type: $OSTYPE"
    echo "🌐 Please manually open: http://localhost:3030"
  fi
fi

echo ""
echo "🎉 RATi Digital Avatar Platform is ready!"
echo "🌐 Frontend: http://localhost:3030"
echo "💬 Chat interface is active and ready for interaction"
echo "⚙️  Deployment API: http://localhost:3032"
echo "📊 Grafana Dashboard: http://localhost:3031"
echo ""

# Keep the service running to show it's active
while true; do
  sleep 30
  if ! check_frontend; then
    echo "⚠️  Frontend service appears to be down"
  fi
done
