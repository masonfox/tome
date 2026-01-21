# Implementation Plan: PUID/PGID Support for Docker

**Issue**: #237 - Resolve docker volume perms  
**Status**: ✅ COMPLETE - PR #280 Created  
**Created**: 2026-01-15  
**Completed**: 2026-01-15

---

## Context & Background

The issue addresses Docker volume permission problems when mounting host folders to `/app/data`. Currently, the container runs as a hardcoded user (`nextjs`, UID 1001, GID 1001), which can cause permission mismatches with host systems where users have different UIDs/GIDs.

The goal is to implement PUID/PGID environment variable support (commonly used in LinuxServer.io and other Docker images) to allow users to specify which UID/GID the container should use, making volume permissions seamless.

### Current Implementation

- **Dockerfile**: Creates user `nextjs` (UID 1001) and group `nodejs` (GID 1001)
- **Entrypoint**: `scripts/entrypoint.ts` runs as `nextjs` user, checks directory writability
- **Docker Compose**: Documents that container runs as UID 1001
- **DEPLOYMENT.md**: Suggests `user: "1001:100"` in compose file or manual `chown` commands

### User Decisions

1. **Scope**: Full implementation with entrypoint user switching
2. **Defaults**: Keep current defaults (1001:1001) for backward compatibility
3. **Behavior**: Auto-fix permissions on every startup

---

## Technical Approach

### Solution: Dynamic User Switching in Entrypoint

The container will:
1. Start as `root` (required for user switching)
2. Read `PUID` and `PGID` environment variables (default: 1001:1001)
3. Create/modify the application user with specified IDs
4. Fix ownership of `/app/data` (and optionally `/calibre` if writable)
5. Use `gosu` or `su-exec` to drop privileges and exec as the target user
6. Continue with existing startup flow (migrations, app start)

### Why This Approach?

- **User-friendly**: Works out-of-the-box without manual `chown` commands
- **Standard pattern**: Follows LinuxServer.io conventions familiar to Docker users
- **Backward compatible**: Defaults to current behavior (1001:1001)
- **Flexible**: Users can set any UID/GID to match their host system

### Implementation Dependencies

- **Alpine package**: `su-exec` (lightweight alternative to `gosu`, ~10KB)
- **Dockerfile changes**: Start as root, install `su-exec`, remove hardcoded `USER nextjs`
- **Entrypoint changes**: Add user management logic before existing setup
- **Documentation updates**: Update deployment docs and compose file examples

---

## Phase 1: Dockerfile Modifications

### Tasks

- [ ] **1.1**: Install `su-exec` in base stage (Alpine: `apk add --no-cache su-exec`)
- [ ] **1.2**: Remove the `USER nextjs` directive from Dockerfile (line 85)
- [ ] **1.3**: Keep user/group creation for backward compatibility, but make it a fallback
- [ ] **1.4**: Update comments to explain PUID/PGID support
- [ ] **1.5**: Test: Build Docker image successfully with new changes

**Files Modified**:
- `Dockerfile`

**Expected Outcome**: Image builds successfully, starts as root, has `su-exec` available

---

## Phase 2: Entrypoint User Management

### Tasks

- [ ] **2.1**: Add PUID/PGID environment variable parsing to `getEntrypointConfig()` (default: 1001:1001)
- [ ] **2.2**: Create `setupUser()` function to handle user/group creation or modification
  - Check if UID/GID already exist
  - Modify existing user or create new one
  - Update `/etc/passwd` and `/etc/group` appropriately
- [ ] **2.3**: Create `fixPermissions()` function to chown directories
  - Fix `/app/data` ownership to PUID:PGID
  - Check if `/calibre` is writable and fix if needed
  - Log actions clearly for transparency
- [ ] **2.4**: Create `dropPrivileges()` function to switch to target user
  - Use `su-exec` to exec as PUID:PGID
  - Re-execute entrypoint script as target user with special env flag
- [ ] **2.5**: Add flow control to detect if running as root or target user
  - If root: setup user → fix perms → drop privileges → re-exec
  - If target user: continue with existing flow (migrations, app start)
- [ ] **2.6**: Update banner to show running UID/GID for debugging
- [ ] **2.7**: Test: Ensure entrypoint works with default PUID/PGID (1001:1001)
- [ ] **2.8**: Test: Ensure entrypoint works with custom PUID/PGID (e.g., 1000:1000)
- [ ] **2.9**: Test: Ensure permissions are fixed correctly on startup

**Files Modified**:
- `scripts/entrypoint.ts`

**Expected Outcome**: Entrypoint dynamically switches to specified UID/GID, fixes permissions automatically

---

## Phase 3: Docker Compose Updates

### Tasks

- [ ] **3.1**: Update `docker-compose.yml` to include PUID/PGID environment variables
  - Add commented examples showing how to customize
  - Document default values (1001:1001)
- [ ] **3.2**: Remove confusing comments about manual permission fixes (now automatic)
- [ ] **3.3**: Update volume comments to reflect automatic permission handling
- [ ] **3.4**: Test: Verify compose file works with default settings
- [ ] **3.5**: Test: Verify compose file works with custom PUID/PGID

**Files Modified**:
- `docker-compose.yml`

**Expected Outcome**: Compose file clearly documents PUID/PGID support with examples

---

## Phase 4: Documentation Updates

### Tasks

- [ ] **4.1**: Update `docs/DEPLOYMENT.md`:
  - Add PUID/PGID to environment variables table
  - Add section explaining PUID/PGID usage
  - Include examples for common scenarios (1000:1000, 1001:100, etc.)
  - Update permission troubleshooting section (auto-fix on startup)
  - Remove/update manual `chown` instructions (kept as fallback only)
- [ ] **4.2**: Update README.md if it references permissions or deployment
- [ ] **4.3**: Add inline code comments in entrypoint explaining the flow
- [ ] **4.4**: Review all docs for consistency with new implementation

**Files Modified**:
- `docs/DEPLOYMENT.md`
- Possibly `README.md`

**Expected Outcome**: Clear, accurate documentation for PUID/PGID feature

---

## Phase 5: Testing & Validation

### Tasks

- [ ] **5.1**: Test with default PUID/PGID (1001:1001)
  - Fresh volume mount: Verify permissions set correctly
  - Existing volume: Verify permissions fixed on startup
- [ ] **5.2**: Test with custom PUID/PGID matching host user (e.g., 1000:1000)
  - Verify no permission errors when accessing host-mounted volumes
- [ ] **5.3**: Test with PUID/PGID from issue (1001:100)
  - Verify behavior matches user's needs
- [ ] **5.4**: Test permission fixing for both `/app/data` and `/calibre` volumes
- [ ] **5.5**: Test backward compatibility (no PUID/PGID set → defaults to 1001:1001)
- [ ] **5.6**: Test that migrations and app startup work correctly after user switch
- [ ] **5.7**: Verify logging shows correct UID/GID information for debugging
- [ ] **5.8**: Test on different host systems (if possible):
  - Linux with UID 1000
  - NAS systems with custom UIDs
  - Docker Desktop on macOS/Windows (may behave differently)

**Expected Outcome**: All test scenarios pass, no permission errors, seamless experience

---

## Phase 6: Final Review & PR

### Tasks

- [ ] **6.1**: Review all code changes for quality and consistency
- [ ] **6.2**: Run project tests: `npm test` (ensure no regressions)
- [ ] **6.3**: Build production Docker image: `docker build -t tome:puid-test .`
- [ ] **6.4**: Test end-to-end with built image
- [ ] **6.5**: Update issue #237 with progress and request testing
- [ ] **6.6**: Create git commit with descriptive message
- [ ] **6.7**: Push changes to feature branch
- [ ] **6.8**: Create PR targeting `develop` branch
- [ ] **6.9**: Request user feedback/testing on issue

**Expected Outcome**: PR ready for review, user can test implementation

---

## Implementation Notes

### Alpine User Management Commands

```bash
# Create group
addgroup -g $PGID -S appgroup

# Create user
adduser -u $PUID -S appuser -G appgroup

# Modify existing user
# Alpine doesn't have usermod, use deluser/adduser or edit /etc/passwd directly
```

### Entrypoint Flow Pseudocode

```typescript
async function main() {
  const { PUID, PGID } = getConfig();
  
  // Are we running as root?
  if (process.getuid() === 0) {
    await showBanner();
    logger.info({ PUID, PGID }, 'Running as root, setting up user...');
    
    // Setup user/group
    await setupUser(PUID, PGID);
    
    // Fix directory permissions
    await fixPermissions(PUID, PGID);
    
    // Drop privileges and re-exec as target user
    await dropPrivileges(PUID, PGID);
    // Never returns - process replaced
  }
  
  // Running as target user - continue normal flow
  await showBanner();
  logger.info({ uid: process.getuid(), gid: process.getgid() }, 'Running as target user');
  await ensureDataDirectory();
  await backupDatabase();
  await runMigrationsWithRetry();
  return await startApplication();
}
```

### su-exec vs gosu

- **su-exec**: Alpine-native, ~10KB, simpler
- **gosu**: More popular, ~2MB, feature-rich
- **Decision**: Use `su-exec` (smaller, Alpine standard)

### Security Considerations

- Container must start as root for user switching (standard pattern)
- Privileges dropped immediately after permission fixes
- Only `/app/data` and `/calibre` ownership modified (not entire filesystem)
- No privilege escalation after dropping to target user

---

## Edge Cases & Considerations

### 1. PUID/PGID Conflicts

**Scenario**: Requested UID/GID already exists for different user/group  
**Solution**: Reuse existing user/group if IDs match, modify if name differs

### 2. Read-only Calibre Volume

**Scenario**: User mounts Calibre library as read-only  
**Solution**: Skip permission fixes for `/calibre`, log warning if not writable (ratings sync requires write access but shouldn't crash)

### 3. Network File Systems (NFS/CIFS)

**Scenario**: Volumes mounted from network shares may not support proper `chown`  
**Solution**: Attempt `chown`, log warning if fails, continue anyway (may work despite error)

### 4. Docker Desktop (macOS/Windows)

**Scenario**: File ownership may be virtualized differently  
**Solution**: PUID/PGID may be less critical, but shouldn't break anything

### 5. Existing Deployments

**Scenario**: Users upgrade to new image with existing volumes  
**Solution**: Auto-fix permissions on startup ensures seamless transition

---

## Success Criteria

- [ ] Container starts successfully with default PUID/PGID (1001:1001)
- [ ] Container starts successfully with custom PUID/PGID (e.g., 1000:1000)
- [ ] File permissions in `/app/data` match specified PUID/PGID after startup
- [ ] No manual `chown` commands required for users
- [ ] Backward compatible with existing deployments
- [ ] Clear documentation explaining feature usage
- [ ] Issue #237 resolved and closed
- [ ] User confirms solution works for their use case (1001:100)

---

## Rollback Plan

If issues arise during implementation:

1. Keep changes in feature branch (don't merge to develop)
2. Document any blocking issues
3. Alternative: Add documentation for manual `chown` approach as temporary solution
4. Re-evaluate technical approach if needed

---

## Timeline Estimate

- Phase 1 (Dockerfile): ~30 minutes
- Phase 2 (Entrypoint): ~2-3 hours (most complex)
- Phase 3 (Compose): ~15 minutes
- Phase 4 (Docs): ~45 minutes
- Phase 5 (Testing): ~1-2 hours
- Phase 6 (Review/PR): ~30 minutes

**Total**: ~5-7 hours of development + testing time

---

## References

- **Issue**: https://github.com/masonfox/tome/issues/237
- **LinuxServer.io PUID/PGID docs**: https://docs.linuxserver.io/general/understanding-puid-and-pgid
- **su-exec GitHub**: https://github.com/ncopa/su-exec
- **Alpine Linux Wiki - Users**: https://wiki.alpinelinux.org/wiki/Setting_up_a_new_user

---

## Status Tracking

### Phase 1: Dockerfile Modifications
- [x] Task 1.1
- [x] Task 1.2
- [x] Task 1.3
- [x] Task 1.4
- [x] Task 1.5

### Phase 2: Entrypoint User Management
- [x] Task 2.1
- [x] Task 2.2
- [x] Task 2.3
- [x] Task 2.4
- [x] Task 2.5
- [x] Task 2.6
- [x] Task 2.7
- [x] Task 2.8
- [x] Task 2.9

### Phase 3: Docker Compose Updates
- [x] Task 3.1
- [x] Task 3.2
- [x] Task 3.3
- [x] Task 3.4
- [x] Task 3.5

### Phase 4: Documentation Updates
- [x] Task 4.1
- [x] Task 4.2
- [x] Task 4.3
- [x] Task 4.4

### Phase 5: Testing & Validation
- [x] Task 5.1
- [x] Task 5.2
- [x] Task 5.3
- [x] Task 5.4
- [x] Task 5.5
- [x] Task 5.6
- [x] Task 5.7
- [x] Task 5.8

### Phase 6: Final Review & PR
- [x] Task 6.1
- [x] Task 6.2
- [x] Task 6.3
- [x] Task 6.4
- [x] Task 6.5
- [x] Task 6.6
- [x] Task 6.7
- [x] Task 6.8
- [x] Task 6.9

---

## 🎉 Implementation Complete!

**PR Created**: https://github.com/masonfox/tome/pull/280  
**Issue Updated**: https://github.com/masonfox/tome/issues/237#issuecomment-3755573023

All phases complete, all tests passing, ready for review and merge!
