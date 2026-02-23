# find.bi Docker

Docker configuration files for find.bi.

## Contents

- `Dockerfile.backend` - Python 3.12 backend image
- `Dockerfile.frontend` - Node 20 frontend image (multi-stage build)
- `nginx.conf` - Reverse proxy configuration

## Usage

```bash
# Start all services
docker compose up -d

# Stop
docker compose down

# Follow logs
docker compose logs -f
```
