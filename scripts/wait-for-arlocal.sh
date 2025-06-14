#!/bin/bash

# Wait for ArLocal to be ready
# This script polls the ArLocal endpoint until it responds

set -e

ARLOCAL_HOST=${1:-localhost}
ARLOCAL_PORT=${2:-1984}
MAX_ATTEMPTS=${3:-30}
WAIT_SECONDS=${4:-2}

echo "⏳ Waiting for ArLocal at $ARLOCAL_HOST:$ARLOCAL_PORT to be ready..."

for i in $(seq 1 $MAX_ATTEMPTS); do
    if curl -s "http://$ARLOCAL_HOST:$ARLOCAL_PORT/info" > /dev/null 2>&1; then
        echo "✅ ArLocal is ready!"
        exit 0
    fi
    
    echo "   Attempt $i/$MAX_ATTEMPTS - ArLocal not ready yet, waiting ${WAIT_SECONDS}s..."
    sleep $WAIT_SECONDS
done

echo "❌ ArLocal failed to start after $MAX_ATTEMPTS attempts"
exit 1
