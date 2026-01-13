# Deployment Guide

This guide covers deploying Tome using Docker, including configuration, volume management, and production best practices.

## Calibre Path
**Note**: Tome requires write access to sync data back to Calibre. You will need to provide an *absolute* path to your Calibre Library folder. Common Calibre library locations:
- **Linux**: `~/Calibre Library/metadata.db`
- **macOS**: `~/Documents/Calibre Library/metadata.db`
- **Windows**: `C:\Users\<username>\Calibre Library\metadata.db`

## Volumes

Tome requires two volume mounts for persistent data and Calibre integration:

| Volume Mount | Container Path | Purpose | Required |
|-------------|----------------|---------|----------|
| `/path/to/storage` | `/app/data` | Tome SQLite database, backups, logs | Yes |
| `/path/to/calibre/library` | `/calibre` | Location of your Calibre library | Yes |


## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `production` | Runtime environment |
| `AUTH_PASSWORD` | (none) | Enables authentication when set. Example: `helloworld` |
| `CALIBRE_DB_PATH` | `/calibre/metadata.db` | Path to Calibre metadata.db inside container |
| `PORT` | `3000` | Application port |
| `DATABASE_PATH` | `/app/data/tome.db` | Path to Tome's SQLite database |

## Docker Deployment Options

Currently, the *only way* to run Tome is through [Docker](https://www.docker.com/). If you're unfamiliar with Docker, I suggest option #1.

### 1. Docker Desktop

[Install Docker Desktop](https://www.docker.com/products/docker-desktop/) and create a container using their GUI, as described in [this article](https://www.educative.io/answers/how-to-create-a-docker-container-in-docker-desktop).

The image is: `ghcr.io/masonfox/tome:latest`. Fill in the volumes detailed above.

### 2. Docker CLI
After replacing the host volume references, run this from the command line or terminal:

```
docker run -d \
  --name tome \
  -p 3000:3000 \
  -v /path/to/storage:/app/data \
  -v /path/to/calibre/library:/calibre \
  -e NODE_ENV=production \
  --restart unless-stopped \
  ghcr.io/masonfox/tome:latest
```

### 3. Preferred: Docker Compose

```
version: '3.8'

services:
  tome:
    image: ghcr.io/masonfox/tome:latest
    container_name: tome
    user: "1001:100"
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - AUTH_PASSWORD=hello # remove to disable auth
    volumes:
      # Persist SQLite database
      - /path/to/storage:/app/data
      # Calibre library
      - /path/to/calibre/folder:/data/calibre
    restart: always
```

**Access the application** at http://localhost:3000. If needed, the `PORT` value in the `.env` can be adjusted to change your local port.

## Database Backups

### Using Built-in Backup Scripts

Tome includes automated backup scripts that work inside the container:

```bash
# Create a timestamped backup
docker exec tome npm run db:backup

# List available backups
docker exec tome npm run db:list-backups

# Restore from backup (interactive)
docker exec -it tome npm run db:restore
```

Backups are stored in `data/backups/` inside the container (part of the `tome-data` volume).

## Database Migrations

Tome uses Drizzle ORM for database schema management. The migrations run automatically on container startup (before the app starts).

If needed, you can run migrations manually:

```bash
docker exec -it tome npm run db:migrate
```

**However**, you're encouraged to run backups _before_ manually running migrations:

```bash
docker exec tome npm run db:backup
```
This is done automatically on container startup.

### Handling Container Updates

To update to a new version:

```bash
# Pull latest image
docker-compose pull

# Stop current container
docker-compose down

# Start new container (migrations run automatically)
docker-compose up -d

# Check logs for successful startup
docker-compose logs -f tome
```

## Common Issues

### Permission Errors

If you encounter permission errors with the data volume:

```bash
sudo chown -R 1001:100 your-tome-directory/
```

The entrypoint script automatically fixes permissions on first run.

### Port Conflicts

If port 3000 is already in use on your host, remap your container's **external** port:

**Compose**:
```yaml
ports:
  - "3001:3000"
```
or via **CLI**:
```bash
-p 3001:3000
```

### Calibre Database Not Accessible

Verify the mount path and permissions:

```bash
# Check if file exists inside container
docker exec tome ls -l /calibre/metadata.db

# Verify environment variable
docker exec tome printenv CALIBRE_DB_PATH
```

## Support

For additional help:
- Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- Review [DATABASE.md](./DATABASE.md) for database operations
- Open an issue on GitHub
