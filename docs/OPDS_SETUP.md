# OPDS Setup Guide

This guide explains how to connect your e-reader or reading app to Tome using OPDS (Open Publication Distribution System) to browse and download books directly from your Calibre library.

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
- **Kobo** (all models with firmware 4.0+)
- **PocketBook** (all models with firmware 5.0+)
- **Tolino** (all models)

### Mobile Apps
- **KOReader** (Android, iOS, Kindle, Kobo)
- **Moon+ Reader** (Android)
- **Readest** (iOS, Android)
- **FBReader** (Android, iOS)
- **Librera Reader** (Android)

## Prerequisites

Before setting up OPDS, ensure:

1. Tome is running and accessible on your network
2. You have your Tome server URL (e.g., `http://192.168.1.100:3000` or `https://tome.example.com`)
3. If you've set an `AUTH_PASSWORD` in Tome, you'll need it for authentication

## Setup Instructions

### General Setup

Most OPDS-compatible apps follow a similar setup process:

1. Find the OPDS catalog or "Add catalog" option in your app's settings
2. Enter the catalog details:
   - **Catalog URL**: `http://your-tome-server:3000/api/opds`
   - **Username**: `tome` (always "tome")
   - **Password**: Your `AUTH_PASSWORD` (if set, leave blank if auth disabled)
3. Save and sync the catalog

### Device-Specific Instructions

#### KOReader

1. Open KOReader and tap the top menu
2. Go to **Search** → **Catalog**
3. Tap **Add catalog**
4. Fill in the details:
   - **Catalog name**: Tome Library
   - **Catalog URL**: `http://your-tome-server:3000/api/opds`
   - **Username**: `tome`
   - **Password**: (your AUTH_PASSWORD if set)
5. Tap **OK** to save
6. Tap on "Tome Library" to browse

**Tips:**
- KOReader supports browsing, searching, and downloading
- Downloaded books appear in your documents folder
- Use the search feature for quick access

#### Moon+ Reader (Android)

1. Open Moon+ Reader
2. Tap **Net Library** from the main menu
3. Tap the **+** button to add a new library
4. Select **OPDS** as the library type
5. Fill in the details:
   - **Name**: Tome
   - **Address**: `http://your-tome-server:3000/api/opds`
   - **Username**: `tome`
   - **Password**: (your AUTH_PASSWORD if set)
6. Tap **OK** to save
7. Tap on "Tome" to browse your library

**Tips:**
- Moon+ Reader has excellent OPDS support
- Books download to your device automatically
- Supports cover thumbnails

#### Readest (iOS/Android)

1. Open Readest
2. Go to **Settings** → **OPDS Catalogs**
3. Tap **Add New Catalog**
4. Fill in:
   - **Name**: Tome Library
   - **URL**: `http://your-tome-server:3000/api/opds`
   - **Authentication**: Select "Basic Auth"
   - **Username**: `tome`
   - **Password**: (your AUTH_PASSWORD if set)
5. Tap **Save**
6. Return to main screen and select "Tome Library"

#### Kobo (Built-in Browser)

Kobo devices don't have built-in OPDS support, but you can use:
1. Install **KOReader** (recommended) - follow KOReader instructions above
2. Or use the Kobo web browser to access Tome's web interface directly

#### PocketBook

1. Open **My Catalogs** from the main menu
2. Tap **Add Catalog**
3. Fill in:
   - **Name**: Tome
   - **URL**: `http://your-tome-server:3000/api/opds`
   - **Username**: `tome`
   - **Password**: (your AUTH_PASSWORD if set)
4. Tap **OK** to save
5. Tap on "Tome" to browse

## Available Features

### Browsing
- **All Books**: Browse your entire library with pagination
- **Search**: Find books by title or author
- More navigation options coming in future updates (authors, series, tags, etc.)

### Book Information
Each book entry shows:
- Title and author(s)
- Cover image (if available)
- Description/summary (if available)
- Series information (if applicable)
- Publisher and publication date
- Available formats

### Downloads
- Books download directly to your device
- **Format Priority**: EPUB is always listed first (most compatible)
- Other formats available: PDF, MOBI, AZW3, and more
- File sizes displayed for each format

## Authentication

### If AUTH_PASSWORD is Set

When you've configured Tome with an `AUTH_PASSWORD`, OPDS endpoints use HTTP Basic Authentication:

- **Username**: Always `tome` (hardcoded)
- **Password**: Your `AUTH_PASSWORD` value
- Authentication is required for all OPDS operations

### If AUTH_PASSWORD is Not Set

- No authentication required
- OPDS catalog is publicly accessible
- Suitable for home networks or trusted environments

**Security Recommendation**: If your Tome instance is accessible from the internet, always set an `AUTH_PASSWORD`.

## Troubleshooting

### "Cannot connect to catalog" Error

**Check network connectivity:**
```bash
# From your e-reader's device (if possible) or another device on the same network
ping your-tome-server-ip
```

**Verify Tome is running:**
- Open `http://your-tome-server:3000` in a web browser
- You should see the Tome web interface

**Check the URL:**
- Ensure you're using `/api/opds` (not just the root URL)
- Example: `http://192.168.1.100:3000/api/opds`

### "Authentication failed" Error

**Verify credentials:**
- Username must be exactly `tome` (lowercase)
- Password must match your `AUTH_PASSWORD`
- Check for typos or extra spaces

**Test authentication:**
```bash
# From a terminal (replace with your details)
curl -u tome:your-password http://your-tome-server:3000/api/opds
```

Should return XML starting with `<?xml version="1.0"...`

### "No books found" or Empty Catalog

**Ensure Calibre sync is complete:**
- Go to Tome web interface
- Navigate to Settings → Sync
- Trigger a manual sync if needed
- Wait for sync to complete

**Check Calibre library:**
- Verify your `CALIBRE_DB_PATH` environment variable is set correctly
- Ensure Calibre library has books in it
- Check Tome logs for sync errors

### Downloads Fail or Don't Work

**Check file formats:**
- Not all devices support all formats
- EPUB is most widely supported
- PDF works on most devices
- MOBI/AZW3 primarily for Kindle-based systems

**Verify Calibre library access:**
- Tome needs read access to your Calibre library folder
- Check file permissions if running in Docker
- Ensure books aren't being moved or deleted

### Slow Performance

**For large libraries (1000+ books):**
- Pagination is automatic (50 books per page)
- Use search to find specific books faster
- Consider filtering/organizing books in Calibre

**Network issues:**
- Use wired connection if possible
- Check WiFi signal strength
- Reduce concurrent downloads

## Advanced Configuration

### Custom Port

If Tome runs on a different port (e.g., 8080):
```
http://your-tome-server:8080/api/opds
```

### HTTPS/Reverse Proxy

If using a reverse proxy with SSL:
```
https://tome.example.com/api/opds
```

Ensure your reverse proxy forwards:
- `Authorization` header (for authentication)
- Supports streaming responses (for downloads)

**Nginx example:**
```nginx
location /api/opds {
    proxy_pass http://localhost:3000/api/opds;
    proxy_set_header Host $host;
    proxy_set_header Authorization $http_authorization;
    proxy_pass_header Authorization;
    proxy_buffering off;  # Important for streaming
}
```

## API Endpoints Reference

For developers or advanced users:

- **Root Catalog**: `/api/opds` - Navigation feed
- **All Books**: `/api/opds/books?offset=0&limit=50` - Acquisition feed
- **Search**: `/api/opds/search?q=searchterm` - Search results
- **Download**: `/api/opds/download/{bookId}/{format}` - File download

All endpoints support:
- HTTP Basic Auth (when AUTH_PASSWORD is set)
- Standard OPDS 1.2 format
- Pagination via `offset` and `limit` parameters

## Frequently Asked Questions

### Can I use OPDS with multiple devices?

Yes! Connect as many devices as you want. Each device independently browses and downloads from your Tome catalog.

### Do downloaded books sync reading progress?

OPDS only handles browsing and downloading. Reading progress tracking depends on your reading app's features. Books read via OPDS won't automatically update Tome's reading progress.

### Can I download books when away from home?

If your Tome instance is accessible from the internet (via dynamic DNS, VPN, or port forwarding), yes. Always use `AUTH_PASSWORD` for security.

### What's the difference between OPDS and Tome's web interface?

- **Web interface**: Full reading tracking, progress logging, stats, goals
- **OPDS**: Browsing and downloading only (native e-reader integration)

Use OPDS when you want to read books on a dedicated e-reader. Use the web interface for tracking and managing your reading.

### Will this work offline?

No. OPDS requires network connectivity to browse and download books. Once downloaded, books are stored locally on your device and can be read offline.

### How do I update my OPDS catalog?

Most apps automatically refresh when you open the catalog. Some have a manual refresh button. The catalog reflects your current Calibre library state.

## Getting Help

If you encounter issues:

1. Check Tome logs for errors
2. Verify network connectivity
3. Test the OPDS URL in a web browser (should return XML)
4. Check GitHub issues: https://github.com/masonfox/tome/issues

## Future Enhancements

Planned improvements for OPDS support:

- Faceted browsing (by author, series, tags)
- Reading status integration (to-read, currently reading, read)
- Custom shelf support
- OPDS 2.0 (JSON format) support

These features are targeted for future releases.
