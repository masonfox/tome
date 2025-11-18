# Claude Code Instructions for Tome

## 📚 Primary Documentation

**Before making any changes, read these docs in order:**

1. **[`docs/AI_CODING_PATTERNS.md`](../docs/AI_CODING_PATTERNS.md)** ⭐ **START HERE**
   - Critical SQLite runtime detection pattern
   - Code style, testing patterns, what to do/not do
   - **Single source of truth for all coding patterns**

2. **[`docs/BOOK_TRACKER_ARCHITECTURE.md`](../docs/BOOK_TRACKER_ARCHITECTURE.md)**
   - Complete system architecture and design
   - Database models, API structure, deployment

3. **[`docs/BOOK_TRACKER_QUICK_REFERENCE.md`](../docs/BOOK_TRACKER_QUICK_REFERENCE.md)**
   - Code examples and snippets

4. **[`__tests__/README.md`](../__tests__/README.md)**
   - Testing patterns and guidelines (99 tests)

## 🎯 Claude Code Workflow

### For Feature Development

1. Read relevant sections in documentation (start with AI_CODING_PATTERNS.md)
2. Use TodoWrite to plan the task if it has 3+ steps
3. Implement following documented patterns
4. Write tests following `__tests__/README.md` guidelines
5. Run `bun test` to ensure all 99 tests pass
6. Update docs if you changed architecture or patterns
7. Mark todos as completed

### For Bug Fixes

1. Locate affected component in architecture docs
2. Understand how it should work
3. Fix following patterns in AI_CODING_PATTERNS.md
4. Add regression test if applicable
5. Run `bun test`

### When Uncertain

**Don't guess** - always:
- Check `docs/AI_CODING_PATTERNS.md` for patterns
- Check `docs/BOOK_TRACKER_ARCHITECTURE.md` for architecture
- Check `docs/BOOK_TRACKER_QUICK_REFERENCE.md` for examples
- Ask the user if still unclear

## 📝 Documentation Updates

Update docs when making changes that affect:
- **Architecture** → `docs/BOOK_TRACKER_ARCHITECTURE.md`
- **Code patterns** → `docs/BOOK_TRACKER_QUICK_REFERENCE.md`
- **Tests** → `__tests__/README.md`
- **Setup/config** → Root `README.md`

**Never create new markdown files without explicit user request.**

## ⚡ Quick Commands

```bash
# Development
bun install                    # Install dependencies
bun run dev                    # Start dev server (auto-sync enabled)
bun test                       # Run all 99 tests (must pass)
bun run build                  # Build for production

# View documentation
cat docs/AI_CODING_PATTERNS.md       # Coding patterns (START HERE)
cat docs/BOOK_TRACKER_ARCHITECTURE.md  # System architecture
cat __tests__/README.md              # Testing guide
```

## 🔑 Most Critical Rule

**Always use the SQLite runtime detection pattern** from `lib/db/calibre.ts:23-34`

See `docs/AI_CODING_PATTERNS.md` for the full pattern and explanation.

Never deviate from this pattern when accessing SQLite databases.

---

**For complete coding patterns, styles, and rules:** See [`docs/AI_CODING_PATTERNS.md`](../docs/AI_CODING_PATTERNS.md)
