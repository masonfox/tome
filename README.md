# 📚 Tome

[!["Buy Me A Coffee"](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://www.buymeacoffee.com/masonfox)

A self-hosted book tracking web application that integrates directly with Calibre's database to provide reading progress tracking, status management, and streak functionality.

**Think**: Goodreads/StoryGraph but powered by your personal Calibre library.

## What is Tome?

Tome is a local-first book tracking application that gives you durable ownership of your reading history. It seamlessly integrates with your existing Calibre library to track reading progress, sessions, and streaks—without disrupting your workflow or requiring cloud services.

Your reading data lives locally, under your control, and survives platform changes forever.

## Why Tome?

- **Durable, local ownership**: Your reading history is stored locally and never locked behind a service
- **Seamless Calibre integration**: Works directly with your Calibre library without modification
- **Self-hosted with zero dependencies**: No Redis, no cloud APIs, no external services—just SQLite
- **Full control over your data**: Host it yourself, backup anytime, own your history forever

## Quick Start

### Local Development

```bash
# Install dependencies
bun install

# Configure environment
cp .env.example .env
# Edit .env and set CALIBRE_DB_PATH to your Calibre library

# Start development server
bun run dev
```

Visit [http://localhost:3000](http://localhost:3000) and sync your Calibre library from the Library page.

### Docker Deployment

**Using pre-built image from GHCR:**

```bash
docker run -d \
  --name tome \
  -p 3000:3000 \
  -v tome-data:/app/data \
  -v /path/to/calibre/library:/calibre:ro \
  -e CALIBRE_DB_PATH=/calibre/metadata.db \
  ghcr.io/masonfox/tome:latest
```

**Using Docker Compose:**

```bash
# Edit docker-compose.yml to set your Calibre library path
docker-compose up -d
```

**Access the application** at http://localhost:3000

For detailed deployment configuration, see [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md).

## Features

- **Calibre Integration**: Direct read-only access to your Calibre database with automatic sync
- **Reading Progress Tracking**: Track page-based or percentage-based progress with history
- **Enhanced Reading Streaks**: Daily streak tracking with configurable goals and analytics
- **Book Status Management**: Organize books by reading status (To Read, Reading, Read)
- **Statistics Dashboard**: Comprehensive reading statistics and visualizations
- **Self-Hosted**: Full control over your data with no external dependencies

## Tech Stack

- **Frontend**: Next.js 14 (App Router)
- **Runtime**: Bun
- **Database**: SQLite (via Drizzle ORM + bun:sqlite)
- **Styling**: Tailwind CSS
- **Calibre Integration**: Direct SQLite database access (read-only)

## Prerequisites

- [Bun](https://bun.sh/) installed (v1.3.0 or higher)
- Calibre library with metadata.db file

## Documentation

Comprehensive documentation is available in the [`/docs`](./docs) directory:

- **[Documentation Index](./docs/README.md)** - Complete guide to all documentation
- **[Deployment Guide](./docs/DEPLOYMENT.md)** - Docker deployment, migrations, and production setup
- **[Database Management](./docs/DATABASE.md)** - Schema management, backups, and maintenance
- **[Troubleshooting](./docs/TROUBLESHOOTING.md)** - Common issues and solutions
- **[Architecture](./docs/ARCHITECTURE.md)** - System architecture and patterns
- **[Testing Guide](./__tests__/README.md)** - Testing patterns and best practices

### For AI Coding Assistants

**Please read [`AI_INSTRUCTIONS.md`](./AI_INSTRUCTIONS.md) before making changes.** This file contains essential patterns and guidelines for maintaining code consistency.

Tool-specific instructions:
- **Claude Code**: See [`.claude/instructions.md`](./.claude/instructions.md)
- **GitHub Copilot**: See [`.github/copilot-instructions.md`](./.github/copilot-instructions.md)

## Development

```bash
# Install dependencies
bun install

# Run database migrations
bun run db:migrate

# Run development server
bun run dev

# Run tests
bun test

# Build for production
bun run build
```

See [docs/DATABASE.md](./docs/DATABASE.md) for complete database management commands.

## Contributing

Contributions are welcome! Before contributing, please:

1. Read the [Architecture Documentation](./docs/ARCHITECTURE.md) to understand the system design
2. Review the [Constitution](./.specify/memory/constitution.md) for project principles
3. Check the [Testing Guide](./__tests__/README.md) for testing best practices
4. Ensure all tests pass: `bun test`

### For AI Assistants Contributing

If you're an AI coding assistant helping with contributions, please read [`AI_INSTRUCTIONS.md`](./AI_INSTRUCTIONS.md) for critical patterns and guidelines.

## License

MIT

## Acknowledgments

Built with a focus on local-first architecture, durable data ownership, and seamless Calibre integration.
