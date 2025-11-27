# Deployment Guide

This guide covers deploying Tome using Docker, including configuration, volume management, and production best practices.

## Docker Deployment Options

### Option 1: Pre-built Image from GHCR (Recommended)

The easiest way to deploy Tome is using the pre-built Docker image from GitHub Container Registry.

```bash
docker run -d \
  --name tome \
  -p 3000:3000 \
  -v tome-data:/app/data \
  -v /path/to/calibre/library:/calibre \
  -e NODE_ENV=production \
  -e CALIBRE_DB_PATH=/calibre/metadata.db \
  --restart unless-stopped \
  ghcr.io/masonfox/tome:latest
```

**Important**: Replace `/path/to/calibre/library` with your actual Calibre library path.

### Option 2: Docker Compose

For easier management, use Docker Compose:

```bash
# Edit docker-compose.yml to set your Calibre library path
docker-compose up -d
```

The included `docker-compose.yml` is pre-configured with:
- Automatic container restart
- Volume persistence
- Calibre library mount with rating sync support
- Production environment settings

### Option 3: Build from Source

To build your own Docker image:

```bash
# Build the image
docker build -t tome .

# Run the container
docker run -d \
  --name tome \
  -p 3000:3000 \
  -v tome-data:/app/data \
  -v /path/to/calibre/library:/calibre \
  -e CALIBRE_DB_PATH=/calibre/metadata.db \
  tome
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `production` | Runtime environment |
| `CALIBRE_DB_PATH` | `/calibre/metadata.db` | Path to Calibre metadata.db inside container |
| `PORT` | `3000` | Application port |
| `DATABASE_PATH` | `/app/data/tome.db` | Path to Tome's SQLite database |

## Volume Management

### Data Persistence

The SQLite database is stored in the `tome-data` volume at `/app/data/tome.db` inside the container. This volume persists across container restarts and updates.

### Calibre Library Mount

Your Calibre library should be mounted with **write access** to enable bidirectional rating synchronization:

```yaml
volumes:
  - /path/to/calibre/library:/calibre
```

**Note**: Tome requires write access to sync ratings back to Calibre. Tome only writes to the ratings field and maintains read-only behavior for all other book metadata.

Common Calibre library locations:
- **Linux**: `~/Calibre Library/metadata.db`
- **macOS**: `~/Documents/Calibre Library/metadata.db`
- **Windows**: `C:\Users\<username>\Calibre Library\metadata.db`

### Docker Volume Operations

```bash
# View volumes
docker volume ls

# Inspect volume details
docker volume inspect tome-data

# View logs
docker-compose logs -f tome

# Restart container
docker-compose restart tome

# Stop and remove (keeps data)
docker-compose down

# Stop and remove all data (WARNING: destructive)
docker-compose down -v
```

## Database Backups

### Using Built-in Backup Scripts

Tome includes automated backup scripts that work inside the container:

```bash
# Create a timestamped backup
docker exec tome bun run db:backup

# List available backups
docker exec tome bun run db:list-backups

# Restore from backup (interactive)
docker exec -it tome bun run db:restore
```

Backups are stored in `/app/data/backups/` inside the container (part of the `tome-data` volume).

### Manual Volume Backup

To backup the entire Docker volume:

```bash
# Create backup archive
docker run --rm \
  -v tome-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/tome-backup-$(date +%Y%m%d).tar.gz -C /data .
```

### Restore from Volume Backup

```bash
# Restore from backup archive
docker run --rm \
  -v tome-data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/tome-backup-YYYYMMDD.tar.gz -C /data
```

## Database Migrations

Tome uses Drizzle ORM for database schema management. Migrations are handled automatically with safety features.

### How Migrations Work in Docker

**Automatic Execution**: Migrations run automatically on container startup (before the app starts)

**Safety Features**:
1. **File-Based Locking**: Prevents concurrent migrations from multiple processes
2. **Pre-Flight Checks**: Validates system state before running migrations
3. **Automatic Backups**: Creates timestamped backups before each migration
4. **Retry Logic**: Handles transient failures gracefully (3 attempts with exponential backoff)

### Migration Process

When the container starts, the entrypoint script:
1. Checks for lock file to prevent concurrent migrations
2. Runs pre-flight checks (data directory writable, migrations present, disk space)
3. Creates automatic backup (if database exists)
4. Executes migrations with retry logic
5. Cleans up old backups (keeps last 3)
6. Starts the application

### Manual Migration

If needed, you can run migrations manually:

```bash
docker exec -it tome bun run lib/db/migrate.ts
```

### Migration Troubleshooting

**Migration fails with "lock file exists":**
- Another migration is already running
- Wait for completion or timeout (5 minutes)
- If stale, the lock will auto-expire

**Migration fails repeatedly:**
- Check container logs: `docker-compose logs tome`
- Verify volume permissions
- Check disk space availability
- Try manual migration: `docker exec -it tome bun run lib/db/migrate.ts`

**Need to roll back a migration:**
```bash
# Find latest backup
docker exec tome ls -lah /app/data/backups/

# Restore it
docker exec tome cp /app/data/backups/tome.db.backup-YYYYMMDD_HHMMSS /app/data/tome.db

# Restart container
docker-compose restart tome
```

## Production Best Practices

### Single Instance Deployment

**CRITICAL**: Never run multiple Tome instances simultaneously with the same database.

SQLite is designed for single-writer scenarios. Running multiple containers will cause:
- Race conditions during migration
- Potential data corruption
- Lock file conflicts

**Never do this:**
```bash
docker-compose up --scale tome=3  # ❌ DO NOT DO THIS
```

### High Availability Strategies

For production deployments:

1. **Blue-Green Deployment**:
   - Run new version alongside old
   - Switch traffic after health checks
   - One instance writes at a time

2. **Separate Migration Step**:
   - Run migrations as CI/CD step before deployment
   - Deploy updated container after migrations complete

3. **Health Checks**:
   - Implement health check endpoint
   - Verify database connectivity
   - Check Calibre sync status

### Container Updates

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

### Security Considerations

1. **Calibre write access**: Tome requires write access for rating sync but only modifies the ratings field
2. **Use named volumes**: Better than bind mounts for portability
3. **Regular backups**: Automate database backups before updates
4. **Non-root user**: Container runs as `nextjs` user (UID 1001)
5. **Network isolation**: Consider using Docker networks for multi-service deployments

### Monitoring

Monitor these aspects in production:

- Container health and restart count
- Database file size growth
- Disk space availability
- Application logs for errors
- Calibre sync frequency and failures

```bash
# Monitor container stats
docker stats tome

# Follow logs in real-time
docker-compose logs -f tome

# Check container health
docker inspect tome | grep -A 10 Health
```

## Common Issues

### Permission Errors

If you encounter permission errors with the data volume:

```bash
# Let the container handle permissions (recommended)
docker-compose up

# Or run with specific user
docker-compose run --user 1001:1001 tome
```

The entrypoint script automatically fixes permissions on first run.

### Port Conflicts

If port 3000 is already in use:

```yaml
# In docker-compose.yml
ports:
  - "3001:3000"  # Map to different host port
```

Or set `PORT` environment variable:

```yaml
environment:
  - PORT=3001
ports:
  - "3001:3001"
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
