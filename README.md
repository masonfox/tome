# 📚️ Tome

[!["Buy Me A Coffee"](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://www.buymeacoffee.com/masonfox)

A self-hosted book tracking web application that integrates directly with Calibre's database to provide reading progress tracking, status management, and streak functionality. 

**Think**: Goodreads/StoryGraph but powered by your personal Calibre library.

## Quick Start

```bash
# Clone the repository
git clone <repository-url>
cd tome

# Install dependencies
bun install

# Configure environment
cp .env.example .env
# Edit .env and set your CALIBRE_DB_PATH

# Start the development server
bun run dev
```

Visit [http://localhost:3000](http://localhost:3000) and sync your Calibre library from the Library page!

**Note**: As of November 2025, Tome has migrated from MongoDB to SQLite for tracking data. No Docker or external database is required.

## Features

- **Calibre Integration**: Direct read-only access to your Calibre database
- **Automatic Sync**: Automatically detects and syncs changes from Calibre (like calibre-web!)
- **Reading Progress Tracking**: Track page-based or percentage-based progress
- **Enhanced Reading Streaks**: Daily streak tracking with configurable thresholds, detailed analytics, and historical visualizations
  - Set personalized daily reading goals (1-9999 pages)
  - Track current and longest streaks
  - View 365 days of reading history with interactive charts
  - Real-time progress indicators and celebration for new records
- **Book Status Management**: To Read, Reading, and Read status tracking
- **Statistics Dashboard**: Comprehensive reading statistics and analytics
- **Self-Hosted**: Full control over your data

## 📚 Documentation

Comprehensive documentation is available in the [`/docs`](./docs) directory:

- **[Documentation Index](./docs/README.md)** - Start here! Complete guide to all documentation
- **[Architecture Documentation](./docs/ARCHITECTURE.md)** - Complete architecture, patterns, and code examples
- **[Testing Guide](./\_\_tests\_\_/README.md)** - Testing patterns and best practices (99+ tests)

### For AI Coding Assistants

**Please read [`AI_INSTRUCTIONS.md`](./AI_INSTRUCTIONS.md) before making changes.** This file contains essential patterns and guidelines for maintaining code consistency.

Tool-specific instructions:
- **Claude Code**: See [`.claude/instructions.md`](./.claude/instructions.md)
- **GitHub Copilot**: See [`.github/copilot-instructions.md`](./.github/copilot-instructions.md)

## Tech Stack

- **Frontend**: Next.js 14 (App Router)
- **Runtime**: Bun
- **Database**: SQLite (via Drizzle ORM + bun:sqlite)
- **Styling**: Tailwind CSS
- **Calibre Integration**: Direct SQLite database access (read-only)

## Prerequisites

- [Bun](https://bun.sh/) installed
- Calibre library with metadata.db file

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd tome
   ```

2. **Install dependencies**
   ```bash
   bun install
   ```

3. **Run database migrations**
   ```bash
   bun run lib/db/migrate.ts
   ```

   This creates the SQLite database at `data/tome.db` with all necessary tables.

4. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and set your Calibre database path:
   ```env
   CALIBRE_DB_PATH=/path/to/calibre/library/metadata.db
   ```

   **Locate your Calibre library:**
   - Linux: Usually `~/Calibre Library/metadata.db`
   - macOS: Usually `~/Documents/Calibre Library/metadata.db`
   - Windows: Usually `C:\Users\<username>\Calibre Library\metadata.db`

5. **Run the development server**
   ```bash
   bun run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

7. **Sync your Calibre library**
   - Go to Library page
   - Click the sync button to import your books

### Database Location

The SQLite database is stored at `data/tome.db`. This file contains all your reading progress, sessions, and streak data.

To backup your data, simply copy this file. To reset, delete it and run migrations again.

### Stopping the application

```bash
# Stop the dev server with Ctrl+C
# That's it! No external services to manage.
```

## Usage

### Dashboard
- View your current reading streak
- See quick stats (books read, pages today, etc.)
- Access currently reading books

### Library
- Browse all your books from Calibre
- Filter by status (To Read, Reading, Read)
- Search by title or author
- Sync with Calibre database

### Book Detail
- View book information synced from Calibre
- Set reading status
- Log reading progress
- View progress history
- Add notes for reading sessions

### Statistics
- View comprehensive reading statistics
- Track reading streaks
- Monitor pages read over time
- Analyze reading velocity

### Settings
- Future home for user preferences and configuration options

## How It Works

1. **Calibre Integration**: The app reads from Calibre's SQLite database (read-only) to get book metadata
2. **Automatic Sync**: A file watcher monitors your Calibre database for changes and automatically syncs when detected
3. **Progress Tracking**: User progress, status, and notes are stored in a local SQLite database (`data/tome.db`)
4. **Streak Calculation**: Automatically calculated based on daily reading activity
5. **Real-time Updates**: Changes are reflected immediately in the UI

### Automatic Sync

The app includes a file system watcher that monitors your Calibre `metadata.db` file for changes. When Calibre modifies the database (adding/editing/removing books), the app automatically syncs those changes within 2 seconds. This works similar to calibre-web's live sync feature.

Features:
- Watches Calibre database for file modifications
- Debounces rapid changes (waits 2 seconds after last change)
- Prevents concurrent syncs
- Initial sync on startup
- Manual sync still available as backup

## Data Models

All tracking data is stored in a local SQLite database (`data/tome.db`) using Drizzle ORM:

### Books Table
Cached book metadata from Calibre with additional tracking fields (orphan detection, last synced, etc.)

### Reading Sessions Table
Tracks reading sessions for each book with status (to-read, read-next, reading, read), ratings, reviews, and completion dates

### Progress Logs Table
Historical log of reading progress entries with page numbers, percentages, dates, and notes

### Streaks Table
Tracks current streak, longest streak, last activity date, and total days active

## API Routes

- `GET /api/calibre/sync` - Sync books from Calibre
- `GET /api/books` - Get all books with filters
- `GET /api/books/:id` - Get specific book
- `POST /api/books/:id/status` - Update book status
- `POST /api/books/:id/progress` - Log reading progress
- `GET /api/streaks` - Get streak data
- `GET /api/stats/overview` - Get reading statistics
- `GET /api/stats/activity` - Get activity calendar data

## Development

```bash
# Install dependencies
bun install

# Run database migrations
bun run db:migrate

# Generate new migration after schema changes
bun run db:generate

# Run development server
bun run dev

# Run tests
bun test

# Build for production
bun run build

# Start production server
bun run start
```

### Database Management

```bash
# Run migrations to create/update schema
bun run db:migrate

# Generate a new migration after schema changes
bun run db:generate

# Push schema directly to database (dev only)
bun run db:push

# Open Drizzle Studio (database browser)
bun run db:studio

# Backup database (recommended before migrations or major operations)
bun run db:backup

# List all available backups
bun run db:list-backups

# Restore database from backup (interactive)
bun run db:restore

# Reset database (delete and recreate)
rm data/tome.db && bun run db:migrate
```

**Backup & Restore Scripts:**

All database backups are stored in `data/backups/` directory:

- **`db:backup`** - Creates timestamped backup (e.g., `tome.db.backup-20251122_143055`)
- **`db:restore`** - Interactive restore from backup with safety backup
- **`db:list-backups`** - Lists all backups with size and timestamp

See [scripts/README.md](scripts/README.md) for detailed documentation on backup/restore operations.

## Troubleshooting

### Calibre Database Not Found
- Verify CALIBRE_DB_PATH points to the correct metadata.db file
- Ensure the file exists and is readable
- Check file permissions

### Books Not Syncing
- Make sure Calibre is closed when syncing
- Verify the database path is correct in `.env`
- Check the browser console and terminal logs for errors

### Database Issues
- Ensure migrations have been run: `bun run lib/db/migrate.ts`
- Check database exists: `ls -la data/tome.db`
- Check database permissions: Ensure `data/` directory is writable
- Reset database if corrupted: `rm data/tome.db && bun run lib/db/migrate.ts`

### Port Already in Use
If port 3000 is already in use:
```bash
# Option 1: Change the port in .env
PORT=3001

# Option 2: Stop the conflicting service
lsof -ti:3000 | xargs kill
```

## Docker Deployment

Tome can be easily deployed using Docker, with all data persisted in volumes.

### Using Docker Compose (Recommended)

1. **Create a docker-compose.yml** (already included in repo)
   ```yaml
   version: '3.8'

   services:
     tome:
       build: .
       ports:
         - "3000:3000"
       environment:
         - NODE_ENV=production
         - CALIBRE_DB_PATH=/calibre/metadata.db
       volumes:
         - tome-data:/app/data                    # SQLite database
         - /path/to/calibre/library:/calibre:ro   # Your Calibre library
       restart: unless-stopped

   volumes:
     tome-data:
   ```

2. **Set your Calibre library path**
   ```bash
   # Edit docker-compose.yml and replace ./calibre-library with your actual path
   # Example: /home/user/Calibre Library
   ```

3. **Start the container**
   ```bash
   docker-compose up -d
   ```

4. **Access the application**
   - Open http://localhost:3000
   - Go to Settings and click "Sync Now"

### Using Docker CLI

```bash
# Build the image
docker build -t tome .

# Run the container
docker run -d \
  --name tome \
  -p 3000:3000 \
  -v tome-data:/app/data \
  -v /path/to/calibre/library:/calibre:ro \
  -e CALIBRE_DB_PATH=/calibre/metadata.db \
  tome
```

### Docker Volume Management

```bash
# View volumes
docker volume ls

# Backup the database (using built-in script)
docker exec tome bun run db:backup

# List available backups
docker exec tome bun run db:list-backups

# Restore from backup (interactive)
docker exec -it tome bun run db:restore

# Backup entire Docker volume (alternative method)
docker run --rm -v tome-data:/data -v $(pwd):/backup alpine \
  tar czf /backup/tome-backup-$(date +%Y%m%d).tar.gz -C /data .

# Restore entire Docker volume from backup
docker run --rm -v tome-data:/data -v $(pwd):/backup alpine \
  tar xzf /backup/tome-backup-YYYYMMDD.tar.gz -C /data

# View logs
docker-compose logs -f tome

# Restart container
docker-compose restart tome

# Stop and remove (keeps data)
docker-compose down

# Stop and remove all data
docker-compose down -v
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `production` | Runtime environment |
| `CALIBRE_DB_PATH` | `/calibre/metadata.db` | Path to Calibre metadata.db inside container |
| `PORT` | `3000` | Application port |

### Notes

- **Data Persistence**: The SQLite database is stored in the `tome-data` volume and persists across container restarts
- **Calibre Library**: Mount your Calibre library as read-only (`:ro`) to prevent accidental modifications
- **Automatic Migrations**: Database migrations run automatically on container startup (not during build)
- **No MongoDB Required**: The container is completely self-contained with no external dependencies
- **⚠️ DO NOT SCALE**: Never run multiple instances simultaneously (see Database Migrations section below)

## Database Migrations

Tome uses Drizzle ORM for database schema management. Migrations are handled automatically but with important safety considerations.

### How Migrations Work

**Development:**
- Migrations must be run manually: `bun run db:migrate`
- This is intentional to give you control over when schema changes occur

**Testing:**
- Migrations run automatically in test setup
- Each test file gets its own isolated in-memory database

**Docker/Production:**
- Migrations run automatically on container startup (before the app starts)
- Includes retry logic (3 attempts with exponential backoff)
- Creates automatic database backups before migrations
- Validates system state with pre-flight checks

### Migration Safety Features

The migration system includes several safety mechanisms:

1. **File-Based Locking**: Prevents concurrent migrations from multiple processes
   - Lock file: `data/.migration.lock`
   - Automatic timeout after 5 minutes if stale
   - PID and timestamp tracking

2. **Pre-Flight Checks**: Validates system state before running migrations
   - Data directory exists and is writable
   - Migration files are present
   - Database file has correct permissions
   - Sufficient disk space available

3. **Automatic Backups**: Creates timestamped backups before each migration
   - Location: `data/backups/` directory
   - Format: `tome.db.backup-YYYYMMDD_HHMMSS`
   - Keeps last 3 backups automatically (Docker migrations only)
   - Skipped on first run (when database doesn't exist)
   - Manual backups via `bun run db:backup` are not automatically cleaned up

4. **Retry Logic**: Handles transient failures gracefully
   - 3 retry attempts with exponential backoff (5s, 10s, 20s)
   - Detailed logging of each attempt
   - Container exits if all retries fail

### Important Limitations

⚠️ **DO NOT run multiple instances simultaneously**

The migration system is designed for single-instance deployments. Running multiple containers at once can cause:
- Race conditions during migration
- Potential data corruption
- Lock file conflicts

**Never run:**
```bash
docker-compose up --scale tome=3  # ❌ DO NOT DO THIS
```

**For high availability:**
- Use blue-green deployment strategy
- Run migrations as a separate CI/CD step before deployment
- Deploy one instance at a time with proper health checks

### Manual Migration Commands

```bash
# Run migrations manually
bun run db:migrate

# Generate a new migration after schema changes
bun run db:generate

# Push schema changes directly (dev only - bypasses migrations)
bun run db:push

# Open Drizzle Studio to browse database
bun run db:studio

# View migration status (check __drizzle_migrations table)
sqlite3 data/tome.db "SELECT * FROM __drizzle_migrations"

# Restore from backup if migration fails
cp data/tome.db.backup-YYYYMMDD_HHMMSS data/tome.db
```

### Troubleshooting Migrations

**Migration fails with "lock file exists":**
- Another migration is already running
- Wait for it to complete or timeout (5 minutes)
- If stale, the lock will auto-expire

**Migration fails repeatedly in Docker:**
- Check container logs: `docker-compose logs tome`
- Verify volume permissions
- Check disk space availability
- Try manual migration: `docker exec -it tome bun run lib/db/migrate.ts`

**Need to roll back a migration:**
- No automatic rollback is provided
- Restore from automatic backup:
  ```bash
  # Find latest backup
  docker exec tome ls -lah /app/data/*.backup-*

  # Restore it
  docker exec tome cp /app/data/tome.db.backup-YYYYMMDD_HHMMSS /app/data/tome.db
  docker-compose restart tome
  ```

## Future Enhancements

- Multi-user support with authentication
- Reading goals and challenges
- Book recommendations
- Mobile-responsive PWA
- Import from Goodreads/StoryGraph
- Reading timer/session tracking
- E-reader device integration

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### For Contributors

Before contributing, please:
1. Read the [Architecture Documentation](./docs/ARCHITECTURE.md) to understand the system design and patterns
2. Review [Implementation Patterns](/.specify/memory/patterns.md) for detailed code examples
3. Check the [Testing Guide](./__tests__/README.md) for testing best practices
4. Ensure all tests pass: `bun test` (99+ tests must pass)
5. Follow the established SQLite runtime detection pattern in `lib/db/calibre.ts`

### For AI Assistants Contributing

If you're an AI coding assistant helping with contributions, please read [`AI_INSTRUCTIONS.md`](./AI_INSTRUCTIONS.md) for critical patterns and guidelines.

## Acknowledgments

Built following the specification from the book-tracker-spec.md document.
