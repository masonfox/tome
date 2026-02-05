# OPDS Setup Guide

This guide explains how to connect your e-reader or reading app to Tome using OPDS (Open Publication Distribution System) to browse and download books directly from your Calibre library, supported by enhancements from Tome, such as the ability to navigate by reading stautses, shelves, ratings, etc.

## What is OPDS?

OPDS is a syndication format for electronic publications that allows reading apps and e-readers to browse and download books from a catalog server. With Tome's OPDS support, you can:

- Browse your entire Calibre library from your e-reader or app
- Search for books by title or author
- Download books in various formats (EPUB, PDF, MOBI, etc.)
- View book covers and metadata
- All without leaving your device!

## Supported Devices and Apps

Tome's OPDS catalog works with any OPDS-compatible device or app, including:

### E-Readers
- **KOReader**
- **Kobo** (all models with firmware 4.0+)
- **PocketBook** (all models with firmware 5.0+)
- **Tolino** (all models)

### Mobile Apps
- **Moon+ Reader** (Android)
- **Readest** (iOS, Android)
- **FBReader** (Android, iOS)
- **Librera Reader** (Android)

_Note_: Not all of these have been manually tested, so please leave compatibility feedback by creating an issue.

## Prerequisites

Before setting up OPDS, ensure:

1. Tome is running and accessible on your network
2. You have your Tome server URL (e.g., `http://192.168.1.100:3000` or `https://tome.example.com`)
3. If you've set an `AUTH_PASSWORD` in your `.env` in Tome, you'll need it for authentication

## Setup Instructions

Your tome OPDS endpoint is available at:

```
/api/opds
```

Most OPDS-compatible apps follow a similar setup process:

1. Find the OPDS catalog or "Add catalog" option in your app's settings
2. Enter the catalog details:
   - **Catalog URL**: `http://your-tome-server:3000/api/opds`
   - **Username**: `tome` (always "tome")
   - **Password**: Your `AUTH_PASSWORD`
      - If you did not set `AUTH_PASSWORD` in your `.env`, then **no password is required**
3. Save and sync the catalog

## Authentication

**Security Recommendation**: If your Tome instance is accessible publically, it's recommended that you set an `AUTH_PASSWORD` in your `.env`.
