# Troubleshooting Guide

This guide covers common issues and their solutions when running Tome.

## Calibre Database Issues

### Calibre Database Not Found

**Symptoms**: Error messages about missing or inaccessible Calibre database

**Solutions**:

1. **Verify the path is correct**:
   ```bash
   # Check your .env file
   cat .env | grep CALIBRE_DB_PATH

   # Verify file exists
   ls -l /path/to/calibre/library/metadata.db
   ```

2. **Check file permissions**:
   ```bash
   # Ensure the file is readable
   chmod 644 /path/to/calibre/library/metadata.db
   ```

3. **Use absolute paths**:
   - Avoid relative paths in `.env`
   - Use full path: `/home/user/Calibre Library/metadata.db`

4. **Common locations**:
   - Linux: `~/Calibre Library/metadata.db`
   - macOS: `~/Documents/Calibre Library/metadata.db`
   - Windows: `C:\Users\<username>\Calibre Library\metadata.db`

### Books Not Syncing

**Symptoms**: Books don't appear in Tome or changes in Calibre aren't reflected

**Solutions**:

1. **Close Calibre before syncing**:
   - Calibre locks the database when open
   - Close Calibre, then trigger sync in Tome

2. **Verify database path**:
   ```bash
   # Confirm environment variable is set
   echo $CALIBRE_DB_PATH
   ```

3. **Check browser console and terminal logs**:
   - Open browser DevTools (F12)
   - Look for error messages in both browser and terminal
   - Check for file permission errors

4. **Manual sync**:
   - Go to Library page
   - Click the sync button explicitly
   - Wait for sync to complete

5. **Check file watcher**:
   - File watcher monitors for changes automatically
   - If not working, manual sync is always available

### Calibre 9.x Database Lock Errors

**Symptoms**: `SQLITE_BUSY` or `SQLITE_LOCKED` errors when rating books or managing tags

**Background**: Calibre 9.0+ uses WAL (Write-Ahead Logging) mode by default, which improves concurrent access but can still cause locks under certain conditions.

**Solutions**:

1. **For Rating Updates** (Usually works with Calibre open):
   - Tome automatically retries rating updates (5-second timeout)
   - If error persists: Close Calibre, wait 5-10 seconds, retry
   - Check logs for retry attempts

2. **For Tag Operations** (Requires Calibre closed):
   - Close Calibre completely (not just minimize)
   - Wait 5-10 seconds for locks to clear
   - Verify Calibre processes are terminated:
     ```bash
     # Linux/macOS
     ps aux | grep calibre
     
     # Windows (PowerShell)
     Get-Process | Where-Object {$_.ProcessName -like "*calibre*"}
     ```
   - Retry the operation

3. **For Stale Locks** (Calibre already closed):
   - Wait 10-15 seconds and retry
   - Check for WAL files:
     ```bash
     ls -la /path/to/calibre/library/metadata.db*
     # Should show: metadata.db, metadata.db-wal, metadata.db-shm
     ```
   - If issue persists, restart Tome
   - Last resort: Restart your system to clear all locks

4. **Check WAL Mode**:
   ```bash
   # Verify Calibre is using WAL mode
   sqlite3 /path/to/calibre/library/metadata.db "PRAGMA journal_mode;"
   # Should return: wal
   ```

5. **Enhanced Error Messages**:
   - Tome provides context-aware error messages
   - Read the error carefully - it includes specific guidance
   - Error message indicates if Calibre appears to be open
   - Follow the suggested action in the error message

**Prevention**:
- Close Calibre before bulk tag operations
- Rating updates should work even with Calibre open
- Use manual sync button after making changes in Calibre

## Database Issues

### Tome Database Not Found

**Symptoms**: Errors about missing `tome.db` or table not found

**Solutions**:

1. **Run migrations**:
   ```bash
   npm run db:migrate
   ```

2. **Check database exists**:
   ```bash
   ls -la data/tome.db
   ```

3. **Verify data directory**:
   ```bash
   # Ensure directory exists and is writable
   mkdir -p data
   chmod 755 data
   ```

4. **Reset database** (WARNING: loses all data):
   ```bash
   rm data/tome.db
   npm run db:migrate
   ```

### Database Corrupted

**Symptoms**: SQLite errors, corrupted data, or crashes when accessing database

**Solutions**:

1. **Restore from backup**:
   ```bash
   # List available backups
   npm run db:list-backups

   # Restore from backup (interactive)
   npm run db:restore
   ```

2. **Check database integrity**:
   ```bash
   sqlite3 data/tome.db "PRAGMA integrity_check;"
   ```

3. **Try to recover**:
   ```bash
   # Dump database to SQL
   sqlite3 data/tome.db .dump > backup.sql

   # Create new database from dump
   rm data/tome.db
   sqlite3 data/tome.db < backup.sql
   ```

4. **If unrecoverable, reset** (loses data):
   ```bash
   rm data/tome.db
   npm run db:migrate
   ```

### Migration Failures

**Symptoms**: Migration errors during startup or when running manually

**Solutions**:

1. **Lock file exists**:
   ```bash
   # Wait for current migration to complete (auto-timeout: 5 minutes)
   # Or remove stale lock file
   rm data/.migration.lock
   ```

2. **Permission errors**:
   ```bash
   # Fix data directory permissions
   chmod 755 data
   chmod 644 data/tome.db
   ```

3. **Check disk space**:
   ```bash
   df -h data/
   ```

4. **View migration status**:
   ```bash
   sqlite3 data/tome.db "SELECT * FROM __drizzle_migrations"
   ```

5. **Restore from pre-migration backup**:
   ```bash
   npm run db:restore
   ```

### Calibre Database Not Accessible in Docker

**Symptoms**: Cannot find Calibre database inside container

**Solutions**:

1. **Verify mount path**:
   ```bash
   # Check if file exists inside container
   docker exec tome ls -l /calibre/metadata.db
   ```

2. **Check docker-compose.yml**:
   ```yaml
   volumes:
     - /absolute/path/to/calibre/library:/calibre:ro
   ```

3. **Verify environment variable**:
   ```bash
   docker exec tome printenv CALIBRE_DB_PATH
   # Should output: /calibre/metadata.db
   ```

4. **Check host path exists**:
   ```bash
   ls -l /absolute/path/to/calibre/library/metadata.db
   ```

### Docker Migrations Failing

**Symptoms**: Container fails to start, migration errors in logs

**Solutions**:

1. **Check container logs**:
   ```bash
   docker-compose logs tome
   ```

2. **Verify volume permissions**:
   ```bash
   docker volume inspect tome-data
   ```

3. **Check disk space**:
   ```bash
   df -h
   ```

4. **Run migration manually**:
   ```bash
   docker exec -it tome npm run db:migrate
   ```

5. **Restore from backup**:
   ```bash
   # List backups
   docker exec tome bun run db:list-backups

   # Restore
   docker exec -it tome bun run db:restore

   # Restart
   docker-compose restart tome
   ```

### Container Won't Start

**Symptoms**: Container exits immediately or won't start

**Solutions**:

1. **Check logs for errors**:
   ```bash
   docker-compose logs tome
   ```

2. **Verify image pulled correctly**:
   ```bash
   docker-compose pull tome
   ```

3. **Check environment variables**:
   ```bash
   docker-compose config
   ```

4. **Ensure volumes are accessible**:
   ```bash
   docker volume ls
   docker volume inspect tome-data
   ```

5. **Try building from source**:
   ```bash
   docker-compose build --no-cache tome
   docker-compose up
   ```

## Development Issues

### Build Failures

**Symptoms**: `bun run build` fails with errors

**Solutions**:

1. **Clean and reinstall dependencies**:
   ```bash
   rm -rf node_modules bun.lock
   bun install
   ```

2. **Check Bun version**:
   ```bash
   bun --version
   # Should be 1.3.0 or higher
   ```

3. **Clear Next.js cache**:
   ```bash
   rm -rf .next
   bun run build
   ```

4. **Check for TypeScript errors**:
   ```bash
   bun run type-check
   ```

### Test Failures

**Symptoms**: `npm test` fails

**Solutions**:

1. **Run migrations**:
   ```bash
   # Tests use in-memory database but need migration files
   npm run db:migrate
   ```

2. **Check for port conflicts**:
   ```bash
   # Some tests may use ports
   lsof -ti:3000 | xargs kill
   ```

4. **Clear test cache**:
   ```bash
   rm -rf node_modules/.cache
   ```

## Getting More Help

If none of these solutions work:

1. **Check existing issues**: [GitHub Issues](https://github.com/masonfox/tome/issues)
2. **Review documentation**:
   - [DEPLOYMENT.md](./DEPLOYMENT.md) for Docker-specific issues
   - [DATABASE.md](./DATABASE.md) for database operations
   - [ARCHITECTURE.md](./ARCHITECTURE.md) for understanding the system
3. **Enable debug logging**: Set `DEBUG=*` environment variable
4. **Open a new issue**: Include logs, configuration, and steps to reproduce

## Preventive Measures

To avoid common issues:

1. **Regular backups**: `npm run db:backup`
2. **Keep Bun updated**: Check for new versions regularly
3. **Monitor disk space**: Ensure adequate space for database growth
4. **Use absolute paths**: Avoid relative paths in configuration
5. **Test after updates**: Run tests after pulling updates
6. **Read release notes**: Check for breaking changes in new versions
