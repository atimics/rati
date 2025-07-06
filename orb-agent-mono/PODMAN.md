# Using Orb Agent Mono with Podman

The Orb Agent system fully supports **Podman** as an alternative to Docker. Podman offers several advantages including rootless containers, better security, and Docker CLI compatibility.

## 🚀 Quick Start with Podman

### Prerequisites

1. **Install Podman**:
   
   **macOS (via Homebrew)**:
   ```bash
   brew install podman
   ```
   
   **Linux (Fedora/CentOS/RHEL)**:
   ```bash
   sudo dnf install podman
   ```
   
   **Linux (Ubuntu/Debian)**:
   ```bash
   sudo apt-get update
   sudo apt-get install podman
   ```

2. **Install Podman Compose** (recommended):
   ```bash
   pip3 install podman-compose
   ```
   
   Or use docker-compose with Podman socket:
   ```bash
   pip3 install docker-compose
   ```

### Setup and Start

The system automatically detects Podman and uses it instead of Docker:

```bash
# Clone the repository
git clone https://github.com/orb-agents/orb-agent-mono.git
cd orb-agent-mono

# Start with Podman (automatically detected)
./start.sh
```

## 🔧 Podman Configuration

### Rootless Mode (Recommended)

Podman's rootless mode allows running containers without root privileges:

```bash
# Initialize rootless mode
podman system migrate

# Start Podman socket for compose compatibility
systemctl --user enable --now podman.socket

# Verify rootless setup
podman info | grep -i rootless
```

### Docker Compatibility

If you have existing Docker workflows, Podman can be used as a drop-in replacement:

```bash
# Create Docker alias (optional)
alias docker=podman

# Or set environment variable for compose
export DOCKER_HOST="unix:///run/user/$(id -u)/podman/podman.sock"
```

**Note**: `podman-compose` has some differences from `docker compose`:
- Doesn't support the `--parallel` flag for builds
- Some advanced networking features may differ
- The start.sh script automatically handles these differences

## 🐧 Platform-Specific Notes

### macOS

On macOS, Podman requires a virtual machine:

```bash
# Initialize Podman machine
podman machine init

# Start the machine
podman machine start

# Set connection (automatically handled by start.sh)
podman system connection default podman-machine-default
```

### Linux

Linux users get the full benefit of rootless containers:

```bash
# Enable user namespaces (if needed)
echo 'user.max_user_namespaces=28633' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# Configure subuid/subgid (usually automatic)
sudo usermod --add-subuids 100000-165535 --add-subgids 100000-165535 $USER
```

## 🔍 Verification

Check that Podman is working correctly:

```bash
# Check Podman installation
podman --version

# Check system info
podman info

# Test with a simple container
podman run --rm hello-world

# Check our system health
./check-system.sh
```

## 🎛️ Advanced Configuration

### Security Enhancements

Podman provides additional security features:

```bash
# Enable SELinux labels (Linux only)
podman run --security-opt label=type:container_runtime_t ...

# Use security profiles
podman run --security-opt seccomp=unconfined ...

# Rootless with user namespaces
podman run --userns=keep-id ...
```

### Performance Tuning

Optimize Podman for development:

```bash
# Increase ulimits for containers
echo 'DefaultLimitNOFILE=65536' | sudo tee -a /etc/systemd/system.conf

# Configure storage driver (overlay2 recommended)
mkdir -p ~/.config/containers
cat > ~/.config/containers/storage.conf << EOF
[storage]
driver = "overlay"
runroot = "/run/user/1000/containers"
graphroot = "/home/user/.local/share/containers/storage"
EOF
```

### Network Configuration

Configure networking for multi-container setup:

```bash
# Create custom network
podman network create orb-network

# Use network in compose (handled automatically)
# The system creates an isolated network for all services
```

## 🔧 Troubleshooting

### Common Issues

1. **Permission Denied**:
   ```bash
   # Ensure user is in required groups
   sudo usermod -aG wheel $USER
   newgrp wheel
   ```

2. **Build Killed (Error 137) - Out of Memory**:
   ```bash
   # Increase Podman machine resources (macOS)
   podman machine stop
   podman machine set --cpus 4 --memory 8192
   podman machine start
   
   # Use lighter Dockerfile if needed
   # Edit docker/compose.dev.yml to use Dockerfile.anchor-light
   ```

2. **Socket Connection Issues**:
   ```bash
   # Restart Podman socket
   systemctl --user restart podman.socket
   
   # Check socket status
   systemctl --user status podman.socket
   ```

3. **Storage Issues**:
   ```bash
   # Clean up storage
   podman system prune -a -f
   
   # Reset storage (caution: removes all containers/images)
   podman system reset
   ```

4. **Port Binding Issues**:
   ```bash
   # Check for conflicting services
   sudo netstat -tulpn | grep :8899
   
   # Kill conflicting processes
   sudo fuser -k 8899/tcp
   ```

### Podman vs Docker Differences

| Feature | Docker | Podman |
|---------|--------|--------|
| Root Required | Yes (daemon) | No (rootless) |
| Architecture | Client-Server | Fork-exec |
| Security | Good | Better (rootless) |
| SystemD Integration | Limited | Native |
| OCI Compliance | Yes | Yes |
| Docker Compose | Native | Via podman-compose |

### Migration from Docker

If you're migrating from Docker:

```bash
# Export Docker images (optional)
docker save image:tag > image.tar
podman load < image.tar

# Convert docker-compose.yml (usually no changes needed)
# Our compose files work with both Docker and Podman

# Update aliases/scripts
alias docker=podman
alias docker-compose=podman-compose
```

## 📊 Performance Comparison

Podman typically offers:
- **Lower memory usage** (no daemon)
- **Faster startup times** (direct exec)
- **Better security** (rootless by default)
- **Native systemd integration**

## 🆘 Getting Help

### Podman Resources
- [Official Documentation](https://docs.podman.io/)
- [Podman Tutorials](https://github.com/containers/podman/tree/main/docs/tutorials)
- [Troubleshooting Guide](https://github.com/containers/podman/blob/main/troubleshooting.md)

### Orb Agent Specific
- Use `./check-system.sh` to verify Podman setup
- Check logs: `./start.sh logs`
- Get system status: `./start.sh status`

## 🎯 Best Practices

1. **Use Rootless Mode**: Better security and no daemon required
2. **Enable Socket**: For docker-compose compatibility
3. **Configure Storage**: Use overlay driver for best performance
4. **Monitor Resources**: Use `podman stats` to monitor containers
5. **Regular Cleanup**: Use `podman system prune` to clean up resources

## 🔐 Security Benefits

Podman provides enhanced security:
- **Rootless containers** by default
- **No daemon** running as root
- **User namespace isolation**
- **SELinux integration** (Linux)
- **cgroups v2 support**

This makes Podman an excellent choice for development and production environments where security is a priority.

---

The Orb Agent system is fully tested and supported with Podman. All features work identically to Docker, with the added benefits of rootless operation and enhanced security. 🚀