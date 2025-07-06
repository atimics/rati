#\!/bin/bash
# Clean up script to remove old images and volumes
echo "Cleaning up old containers and images..."

if command -v podman &> /dev/null; then
    echo "Using podman for cleanup..."
    podman-compose -f docker/compose.dev.yml down -v || true
    podman system prune -af || true
elif command -v docker &> /dev/null; then
    echo "Using docker for cleanup..."
    docker compose -f docker/compose.dev.yml down -v || true
    docker system prune -af || true
fi

echo "Cleanup complete. You can now run ./start.sh"

