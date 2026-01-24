# Plan: Alert on Patch Versions During Alpha

**Created:** 2026-01-23  
**Status:** Planning  
**Context:** For alpha (pre-1.0) versions, we should alert users about patch updates since even small changes can be significant during active development.

---

## Context/Background

Currently, the version check logic:
- ✅ Alerts on major version changes (0.x.x → 1.x.x)
- ✅ Alerts on minor version changes (0.4.x → 0.5.x)
- ❌ Does NOT alert on patch changes (0.4.0 → 0.4.1)

**Rationale for Change:**
Since Tome is in alpha (v0.5.0), even patch releases may contain important bug fixes, security updates, or minor features that users should be aware of. Once the project reaches v1.0.0+, we can revert to only alerting on major versions (or major + minor).

---

## Affected Files

1. **`app/api/version/route.ts`** - Main version comparison logic
2. **`__tests__/e2e/api/version.test.ts`** - Test suite for version API
3. **Documentation** (optional) - Update comments to reflect new behavior

---

## Implementation Plan

### Phase 1: Update Version Comparison Logic ⏳

**Task 1.1:** Modify `compareVersions` function in `app/api/version/route.ts`
- **Current behavior** (lines 94-98): Returns `hasUpdate: false` for patch updates
- **New behavior:** Return `hasUpdate: true, isMinorOrMajor: false` for patch updates when major version is 0
- **Approach:** Add condition to check if current version is pre-1.0 (major === 0) and treat patches as significant

**Task 1.2:** Update function comments
- Update comment on line 69-70 to clarify patch version handling during alpha
- Update file header comment (line 11) to mention patch notifications for pre-1.0

---

### Phase 2: Update Tests ⏳

**Task 2.1:** Modify existing test at line 70 (`__tests__/e2e/api/version.test.ts`)
- **Current:** "does not notify for patch version updates (0.4.0 -> 0.4.1)"
- **New:** "DOES notify for patch version updates during alpha (0.4.0 -> 0.4.1)"
- Update assertions to expect `hasNewVersion: true`

**Task 2.2:** Add new test for post-1.0 behavior
- **Test:** "does not notify for patch version updates post-1.0 (1.0.0 -> 1.0.1)"
- **Purpose:** Ensure we DON'T alert on patches after reaching stable v1.0.0
- **Assertions:** Expect `hasNewVersion: false` for 1.0.0 → 1.0.1

**Task 2.3:** Add edge case test
- **Test:** "notifies for patch during pre-1.0 but identifies as patch (not minor/major)"
- **Purpose:** Verify that `isMinorOrMajor: false` but `hasNewVersion: true` for patches during alpha
- **Assertions:** Check both flags are set correctly

---

### Phase 3: Update Response Interface (if needed) ⏳

**Task 3.1:** Review `VersionResponse` interface
- **Current fields:**
  - `hasNewVersion: boolean` - Whether to show notification
  - `isMinorOrMajor: boolean` - Whether it's a significant update
- **Decision:** Determine if we need a new field like `updateType: 'major' | 'minor' | 'patch'` for better UI control
- **Recommendation:** Keep existing fields; `isMinorOrMajor: false` can indicate patch update

---

### Phase 4: Verify UI Behavior ⏳

**Task 4.1:** Review `components/Settings/VersionSettings.tsx`
- **Current:** Shows notification when `hasNewVersion === true` (line 53)
- **Verify:** Component will correctly display patch updates
- **No changes expected:** UI should work as-is since it checks `hasNewVersion`

**Task 4.2:** Consider notification styling differentiation (optional)
- **Question:** Should patch updates look different from minor/major updates in the UI?
- **Current:** All updates shown with same styling (exclamation icon, accent color)
- **Recommendation:** Keep consistent for now; can refine later based on user feedback

---

### Phase 5: Run Tests & Verify ⏳

**Task 5.1:** Run version API tests
```bash
npm run test:e2e -- __tests__/e2e/api/version.test.ts
```

**Task 5.2:** Run full test suite
```bash
npm test
```

**Task 5.3:** Manual verification (optional)
- Mock a patch release in test environment
- Verify notification appears in Settings UI

---

## Implementation Approach

### Option A: Alert on ALL patches during pre-1.0 (Recommended)
```typescript
// For 0.x.x versions, treat ALL updates as significant
if (curr.major === 0) {
  if (lat.major > curr.major || lat.minor > curr.minor || lat.patch > curr.patch) {
    // Major/minor are more significant than patch
    const isMinorOrMajor = lat.major > curr.major || lat.minor > curr.minor;
    return { hasUpdate: true, isMinorOrMajor };
  }
}
```

**Pros:**
- Simple logic
- Users stay informed during active development
- Reduces chance of missing important bug fixes

**Cons:**
- More frequent notifications
- Patch version fatigue (users might ignore updates)

### Option B: Add configuration flag for patch notifications
Add a config option to toggle patch notifications.

**Pros:**
- Flexible for different deployment scenarios
- Can be changed without code updates

**Cons:**
- Added complexity
- Overkill for current needs
- More code to maintain

**Recommendation:** Go with **Option A** for simplicity. We can always add configuration later if needed.

---

## Post-1.0 Behavior

Once Tome reaches v1.0.0, the version logic should:
- ✅ Alert on major version changes (1.x.x → 2.x.x)
- ✅ Alert on minor version changes (1.0.x → 1.1.x) 
- ❌ NOT alert on patch changes (1.0.0 → 1.0.1)

This behavior is **already coded** (line 84-92) and will automatically activate when major version becomes 1 or higher.

---

## Questions for User

1. **Notification frequency:** Are you comfortable with potentially more frequent update notifications during alpha?

2. **UI differentiation:** Should patch updates be styled differently from minor/major updates (e.g., less prominent)?

3. **Post-1.0 behavior:** After v1.0.0 release, should we alert on:
   - Major only?
   - Major + Minor?
   - Major + Minor + Patch?

4. **Testing:** Do you want manual testing in addition to automated tests?

---

## Rollback Plan

If this causes issues:
1. Revert changes to `compareVersions` function
2. Revert test changes
3. All previous behavior will be restored
4. No data migrations or database changes involved

---

## Notes

- No breaking changes
- No database migrations required
- No API contract changes
- Backward compatible with existing clients
- GitHub API caching (24hr) remains unchanged
