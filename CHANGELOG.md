# Changelog

All notable changes to Tome will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Calibre 9.x WAL Mode Compatibility**: Full support for Calibre 9.0+ which uses WAL (Write-Ahead Logging) mode by default
  - Automatic journal mode detection (WAL vs DELETE) 
  - File watcher now monitors both `metadata.db` and `metadata.db-wal` for changes
  - Busy timeout (5 seconds) prevents immediate SQLITE_LOCKED errors
  - Rating updates work with Calibre open (automatic retry logic)
  - Enhanced error messages distinguish "Calibre is open" vs "stale lock" scenarios

### Fixed
- SQLITE_BUSY/SQLITE_LOCKED errors when using Tome with Calibre 9.x
- File watcher not detecting changes when Calibre 9.x uses WAL mode
- Database lock conflicts when editing tags with Calibre open

### Changed
- Database factory now supports `wal: 'auto'` mode to auto-detect Calibre's journal mode
- Calibre write connection no longer forces DELETE mode, respects existing journal mode
- Error messages provide context-aware guidance for lock errors

## Format Guidelines

### Categories
- **Added** for new features
- **Changed** for changes in existing functionality
- **Deprecated** for soon-to-be removed features
- **Removed** for now removed features
- **Fixed** for any bug fixes
- **Security** for vulnerability fixes

### Version Format
Versions use semantic versioning: `MAJOR.MINOR.PATCH`
- MAJOR: Breaking changes
- MINOR: New features (backward compatible)
- PATCH: Bug fixes (backward compatible)
