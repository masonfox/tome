# Tome v0.1.0 - Initial Release

**Release Date:** December 1, 2025

We're excited to announce the initial release of **Tome** - a self-hosted book tracking application with seamless Calibre integration!

## 🎯 What is Tome?

Tome is a local-first book tracking app that gives you durable ownership of your reading history. Think Goodreads/StoryGraph but powered by your personal Calibre library - no cloud services required, no vendor lock-in, just your data under your control.

## ✨ Core Features

### 📚 Calibre Integration
- **Direct database access**: Read-only access to your Calibre library
- **Automatic sync**: File watcher detects Calibre changes within 2 seconds
- **Bidirectional rating sync**: Rate books in Tome, syncs to Calibre (1-5 stars ↔ 2/4/6/8/10)
- **Zero disruption**: Works alongside Calibre without modifications

### 📖 Reading Progress Tracking
- Track progress by **pages or percentage**
- Log reading sessions with optional notes
- Edit or delete progress entries
- Backdate entries for historical tracking
- **Temporal validation**: Maintains timeline consistency
- **Auto-completion**: Automatically marks books as "read" at 100%

### 📊 Status Management
- Organize books: **To Read → Read Next → Reading → Read**
- Session-based tracking with full history
- **Re-reading support**: Start new sessions for books you've already read
- Reading history view with per-session progress summaries

### 🔥 Reading Streaks
- **Timezone-aware streak tracking**: Uses your local timezone, not UTC
- **Configurable daily goals**: Set your own page threshold (1-9999 pages/day)
- **Auto-reset detection**: Check-on-read pattern (no cron jobs needed)
- Track current streak, longest streak, and total active days
- Comprehensive analytics with calendar heatmap

### 📈 Statistics Dashboard
- Books read (total, this year, this month)
- Pages read with daily averages
- Currently reading overview
- Activity calendar and monthly breakdowns
- Reading velocity metrics

### 🚀 Self-Hosted & Zero Dependencies
- **Fully local**: SQLite database, no Redis, no cloud APIs
- **Docker ready**: Pre-built images on GHCR
- **Auto-migrations**: Database schema updates on startup
- **Backup tools**: Built-in database backup scripts
- **Single binary**: Runs on Bun or Node.js

## 🛠️ Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, Tailwind CSS
- **Backend**: Bun runtime with Next.js API Routes
- **Database**: SQLite + Drizzle ORM
- **Testing**: 702 passing tests across 47 test files
- **Architecture**: Repository pattern + Service layer

## 📦 Installation

### Docker (Recommended)

```bash
docker run -d \
  --name tome \
  -p 3000:3000 \
  -v tome-data:/app/data \
  -v /path/to/calibre/library:/calibre \
  -e CALIBRE_DB_PATH=/calibre/metadata.db \
  ghcr.io/masonfox/tome:latest
```

### Docker Compose

```bash
# Edit docker-compose.yml to set your Calibre library path
docker-compose up -d
```

### Local Development

```bash
# Install dependencies
bun install

# Configure environment
cp .env.example .env
# Edit .env and set CALIBRE_DB_PATH

# Run migrations
bun run db:migrate

# Start development server
bun run dev
```

Visit http://localhost:3000

## 📖 Documentation

Comprehensive documentation available in the `/docs` directory:
- **[Deployment Guide](docs/DEPLOYMENT.md)** - Docker, production setup, migrations
- **[Database Management](docs/DATABASE.md)** - Schema, backups, maintenance
- **[Architecture](docs/ARCHITECTURE.md)** - System design and patterns
- **[Troubleshooting](docs/TROUBLESHOOTING.md)** - Common issues and solutions
- **[Testing Guide](__tests__/README.md)** - Testing patterns and practices

## 🎓 Architecture Highlights

This release includes several architectural decisions documented in ADRs:
- **ADR-001**: MongoDB → SQLite migration (simplicity, zero dependencies)
- **ADR-002**: Rating system architecture (5-star scale, Calibre sync)
- **ADR-003**: Book detail frontend refactoring (custom hooks + components)
- **ADR-004**: Backend service layer (clean architecture, testability)
- **ADR-005**: Structured logging with Pino
- **ADR-006**: Timezone-aware date handling

## 🧪 Quality Metrics

- **702 passing tests** (1,937 assertions)
- **47 test files** covering units, integration, and components
- **6 ADRs** documenting major architectural decisions
- **15+ documentation files** covering all aspects of the system

## 🔮 Known Limitations

This is an initial release (v0.x) - the API may evolve based on real-world usage:

- No data export/import functionality yet ([#14](https://github.com/masonfox/tome/issues/14))
- No Goodreads/StoryGraph import ([#11](https://github.com/masonfox/tome/issues/11))
- Toast notifications need design polish ([#12](https://github.com/masonfox/tome/issues/12))
- Search doesn't support advanced operators yet ([#3](https://github.com/masonfox/tome/issues/3))

See the [open issues](https://github.com/masonfox/tome/issues) for the full roadmap.

## 🚧 v0.x Stability

As a v0.x release, Tome's APIs are **not yet locked**. We may make breaking changes between minor versions (v0.1.0 → v0.2.0) as we gather feedback and refine the system. We'll bump to v1.0.0 once the API is proven stable through real-world usage.

**Semantic versioning in v0.x:**
- `v0.x.0`: May include breaking changes
- `v0.x.y`: Backwards-compatible patches and features

## 🙏 Acknowledgments

Built with a focus on:
- **Local-first architecture**: Your data, your control
- **Durable ownership**: Reading history that survives platform changes
- **Seamless integration**: Works with your existing Calibre workflow
- **Production quality**: Comprehensive tests, documentation, and deployment tools

## 📝 License

MIT License - See [LICENSE](LICENSE) file for details

## 🔗 Links

- **Repository**: https://github.com/masonfox/tome
- **Docker Image**: ghcr.io/masonfox/tome:latest
- **Issues**: https://github.com/masonfox/tome/issues
- **Discussions**: https://github.com/masonfox/tome/discussions

---

**Ready to get started?** Check out the [Quick Start guide](README.md#quick-start) or jump straight to [Deployment](docs/DEPLOYMENT.md).

Thank you for trying Tome! We'd love to hear your feedback.
