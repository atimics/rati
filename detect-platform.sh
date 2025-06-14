#!/bin/bash

# Platform detection script for RATi Docker Compose
# Automatically detects the platform and sets appropriate Docker Compose configuration

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

echo "🔍 Detecting platform architecture..."

# Detect the platform
ARCH=$(uname -m)
OS=$(uname -s)

echo "📊 Detected: $OS $ARCH"

# Set Docker platform based on detected architecture
case $ARCH in
    x86_64|amd64)
        export DOCKER_DEFAULT_PLATFORM=linux/amd64
        PLATFORM="linux/amd64"
        ;;
    arm64|aarch64)
        export DOCKER_DEFAULT_PLATFORM=linux/arm64
        PLATFORM="linux/arm64"
        ;;
    *)
        echo "⚠️  Unknown architecture: $ARCH, defaulting to linux/amd64"
        export DOCKER_DEFAULT_PLATFORM=linux/amd64
        PLATFORM="linux/amd64"
        ;;
esac

echo "🏗️  Setting Docker platform to: $PLATFORM"

# Update .env file with platform information
if [ -f .env ]; then
    # Remove existing DOCKER_DEFAULT_PLATFORM if it exists
    sed -i.bak '/^DOCKER_DEFAULT_PLATFORM=/d' .env
    rm -f .env.bak
fi

echo "DOCKER_DEFAULT_PLATFORM=$PLATFORM" >> .env

# Create platform-specific docker-compose override if needed
if [ "$ARCH" = "arm64" ] || [ "$ARCH" = "aarch64" ]; then
    echo "🍎 Detected ARM64 (Apple Silicon), creating platform override..."
    cat > docker-compose.override.yml << EOF
# Platform override for ARM64/Apple Silicon
services:
  arlocal:
    platform: linux/amd64
    
  deployment-service:
    platform: linux/amd64
    
  frontend:
    platform: linux/amd64
    
  ai-agent:
    platform: linux/amd64
    
  rati-cli:
    platform: linux/amd64
EOF
    echo "✅ Created docker-compose.override.yml for ARM64 compatibility"
else
    # Remove override file if it exists and we're on x86_64
    if [ -f docker-compose.override.yml ]; then
        rm docker-compose.override.yml
        echo "🗑️  Removed docker-compose.override.yml (not needed for x86_64)"
    fi
fi

echo "✅ Platform detection complete"
echo "🚀 Platform: $PLATFORM"
echo "📝 Environment updated"

# Run the command passed as arguments
if [ $# -gt 0 ]; then
    echo "🎯 Executing: $*"
    exec "$@"
fi
