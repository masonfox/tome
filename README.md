# 📚️ Tome

[!["Buy Me A Coffee"](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://www.buymeacoffee.com/masonfox)

A self-hosted book tracking web application that integrates directly with Calibre's database to provide reading progress tracking, status management, and streak functionality. 

**Think**: Goodreads/StoryGraph but powered by your personal Calibre library.

## Quick Start

```bash
# Clone the repository
git clone <repository-url>
cd tome

# Start MongoDB
docker-compose up -d

# Install dependencies
bun install

# Configure environment
cp .env.example .env
# Edit .env and set your CALIBRE_DB_PATH

# Start the development server
bun run dev
```

Visit [http://localhost:3000](http://localhost:3000) and sync your Calibre library from the Settings page!

## Features

- **Calibre Integration**: Direct read-only access to your Calibre database
- **Automatic Sync**: Automatically detects and syncs changes from Calibre (like calibre-web!)
- **Reading Progress Tracking**: Track page-based or percentage-based progress
- **Reading Streaks**: Daily streak tracking with activity calendar
- **Book Status Management**: To Read, Reading, and Read status tracking
- **Statistics Dashboard**: Comprehensive reading statistics and analytics
- **Self-Hosted**: Full control over your data

## 📚 Documentation

Comprehensive documentation is available in the [`/docs`](./docs) directory:

- **[Documentation Index](./docs/README.md)** - Start here! Complete guide to all documentation
- **[System Architecture](./docs/BOOK_TRACKER_ARCHITECTURE.md)** - Complete technical architecture and design
- **[Quick Reference](./docs/BOOK_TRACKER_QUICK_REFERENCE.md)** - Code patterns and examples
- **[Testing Guide](./\_\_tests\_\_/README.md)** - Testing patterns and best practices (99 tests)

### For AI Coding Assistants

**Please read [`AI_INSTRUCTIONS.md`](./AI_INSTRUCTIONS.md) before making changes.** This file contains essential patterns and guidelines for maintaining code consistency.

Tool-specific instructions:
- **Claude Code**: See [`.claude/instructions.md`](./.claude/instructions.md)
- **GitHub Copilot**: See [`.github/copilot-instructions.md`](./.github/copilot-instructions.md)

## Tech Stack

- **Frontend**: Next.js 14 (App Router)
- **Runtime**: Bun
- **Database**: MongoDB (for tracking data)
- **Styling**: Tailwind CSS
- **Calibre Integration**: Direct SQLite database access (read-only)

## Prerequisites

- [Bun](https://bun.sh/) installed
- [Docker](https://www.docker.com/) and Docker Compose (for MongoDB)
- Calibre library with metadata.db file

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd tome
   ```

2. **Start MongoDB with Docker Compose**
   ```bash
   docker-compose up -d
   ```

   This starts a MongoDB container in the background. Data is persisted in a Docker volume.

3. **Install dependencies**
   ```bash
   bun install
   ```

4. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and set your Calibre database path:
   ```env
   CALIBRE_DB_PATH=/path/to/calibre/library/metadata.db
   MONGODB_URI=mongodb://localhost:27017/book-tracker
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
   - Go to Settings page
   - Click "Sync Now" to import your books

### Stopping the application

```bash
# Stop the dev server with Ctrl+C

# Stop MongoDB
docker-compose down

# Stop MongoDB and delete data
docker-compose down -v
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
- Configure Calibre integration
- Trigger manual sync with Calibre
- View database configuration

## How It Works

1. **Calibre Integration**: The app reads from Calibre's SQLite database (read-only) to get book metadata
2. **Automatic Sync**: A file watcher monitors your Calibre database for changes and automatically syncs when detected
3. **Progress Tracking**: User progress, status, and notes are stored in MongoDB
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

### Books Collection
Cached from Calibre with tracking metadata

### Reading Status Collection
Tracks current status (to-read, reading, read) for each book

### Progress Log Collection
Historical log of reading progress with dates and notes

### Streaks Collection
Tracks current streak, longest streak, and total active days

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
# Make sure MongoDB is running
docker-compose up -d

# Install dependencies
bun install

# Run development server
bun run dev

# Build for production
bun run build

# Start production server
bun run start
```

### MongoDB Management

```bash
# Start MongoDB
docker-compose up -d

# Stop MongoDB
docker-compose down

# View MongoDB logs
docker-compose logs -f mongodb

# Reset MongoDB data
docker-compose down -v
```

## Troubleshooting

### Calibre Database Not Found
- Verify CALIBRE_DB_PATH points to the correct metadata.db file
- Ensure the file exists and is readable
- Check file permissions

### Books Not Syncing
- Make sure Calibre is closed when syncing
- Verify the database path is correct in `.env`
- Check the browser console and terminal logs for errors

### MongoDB Connection Issues
- Ensure MongoDB is running: `docker-compose ps`
- Check MongoDB logs: `docker-compose logs mongodb`
- Verify MONGODB_URI in `.env` is `mongodb://localhost:27017/book-tracker`
- Try restarting MongoDB: `docker-compose restart mongodb`

### Port Already in Use
If port 3000 is already in use:
```bash
# Option 1: Change the port in .env
PORT=3001

# Option 2: Stop the conflicting service
lsof -ti:3000 | xargs kill
```

### MongoDB Port Conflict
If MongoDB port 27017 is already in use:
```bash
# Edit docker-compose.yml and change the port mapping
ports:
  - "27018:27017"  # Use 27018 on host instead

# Then update .env
MONGODB_URI=mongodb://localhost:27018/book-tracker
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
1. Read the [Architecture Documentation](./docs/BOOK_TRACKER_ARCHITECTURE.md) to understand the system design
2. Review the [Quick Reference](./docs/BOOK_TRACKER_QUICK_REFERENCE.md) for code patterns
3. Check the [Testing Guide](./__tests__/README.md) for testing best practices
4. Ensure all tests pass: `bun test` (99 tests must pass)
5. Follow the established SQLite runtime detection pattern in `lib/db/calibre.ts`

### For AI Assistants Contributing

If you're an AI coding assistant helping with contributions, please read [`AI_INSTRUCTIONS.md`](./AI_INSTRUCTIONS.md) for critical patterns and guidelines.

## Acknowledgments

Built following the specification from the book-tracker-spec.md document.
