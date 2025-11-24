# Claude Code Instructions for Tome

**Read the universal AI instructions first:** [`AI_INSTRUCTIONS.md`](../AI_INSTRUCTIONS.md)

---

## 📚 Quick Start

All documentation is in `AI_INSTRUCTIONS.md`. This file contains only Claude Code-specific features.

**Essential reading order:**
1. `.specify/memory/constitution.md` - Project principles
2. `.specify/memory/patterns.md` - Code patterns
3. `docs/ARCHITECTURE.md` - System design
4. `docs/AI_CODING_PATTERNS.md` - Coding standards

---

## 🎯 Claude Code Specific Features

### SpecKit Slash Commands

Use SpecKit for feature development:

- `/speckit.specify [feature]` - Create feature specification
- `/speckit.plan` - Generate implementation plan with constitution checks
- `/speckit.tasks` - Break down into actionable tasks
- `/speckit.implement` - Execute implementation
- `/speckit.clarify` - Identify underspecified areas
- `/speckit.checklist` - Generate custom checklist
- `/speckit.analyze` - Cross-artifact consistency analysis

**See `docs/SPECKIT_WORKFLOW.md` for complete workflow.**

### TodoWrite Tool

Use TodoWrite for complex tasks (3+ steps):

```markdown
1. Create todos at start of complex task
2. Mark in_progress when starting
3. Mark completed when done
4. Keep only ONE todo in_progress at a time
```

**When to use:**
- Multi-step features
- Complex refactorings
- When user provides a list of tasks

**When NOT to use:**
- Single-step tasks
- Trivial changes

### Task Tool

Use Task tool to spawn specialized agents:

- `Explore` - Quick codebase exploration (file patterns, keyword search)
- `Plan` - Same as Explore but for planning mode
- `claude-code-guide` - Claude Code documentation lookup

### Parallel Execution

When launching multiple agents, send a SINGLE message with multiple Task calls (not sequential messages).

---

## 📝 Claude Code Workflow

### For New Features (SpecKit)

1. `/speckit.specify [feature description]` - Create spec
2. Review generated spec with user
3. `/speckit.plan` - Generate implementation plan
4. Review plan (includes constitution checks)
5. `/speckit.tasks` - Break into tasks
6. `/speckit.implement` - Execute (or implement manually)

### For Feature Development (Manual)

1. Read relevant docs (start with `.specify/memory/patterns.md`)
2. Use TodoWrite if task has 3+ steps
3. Implement following documented patterns
4. Write tests following `__tests__/README.md`
5. Run `bun test` (all 99+ tests must pass)
6. Mark todos as completed

### For Bug Fixes

1. Locate affected component in `docs/ARCHITECTURE.md`
2. Understand how it should work
3. Fix following patterns in `.specify/memory/patterns.md`
4. Add regression test if applicable
5. Run `bun test`

---

## 🔄 Git Workflow

### Creating Commits

Only create commits when user requests. Follow the Git Safety Protocol:

- NEVER update git config
- NEVER run destructive git commands without explicit request
- NEVER skip hooks unless user requests
- Run `git status` and `git diff` in parallel before committing
- Draft meaningful commit message following repository style
- Include co-authorship footer in commit message

### Creating Pull Requests

When user asks for PR:

1. Run `git status`, `git diff`, and `git log` in parallel
2. Analyze ALL commits (not just latest)
3. Draft PR summary covering all changes
4. Push with `-u` if needed
5. Use `gh pr create` with title and body (HEREDOC format)
6. Return PR URL to user

---

## ⚡ Quick Commands

```bash
# Development
bun install                    # Install dependencies
bun run dev                    # Start dev server
bun test                       # Run all tests (must pass 99+)
bun run build                  # Build for production

# View documentation (in order)
cat .specify/memory/constitution.md   # Project principles
cat .specify/memory/patterns.md       # Code patterns (10 patterns)
cat docs/ARCHITECTURE.md               # System architecture
cat docs/AI_CODING_PATTERNS.md         # Coding standards
cat AI_INSTRUCTIONS.md                 # Universal AI guide
```

---

## 📌 Remember

- **Read `AI_INSTRUCTIONS.md` first** - Universal guidance for all agents
- **Constitution defines rules** - `.specify/memory/constitution.md`
- **Patterns provide code** - `.specify/memory/patterns.md` has working examples
- **SpecKit for features** - Use `/speckit.*` commands for structured development
- **TodoWrite for planning** - Complex tasks benefit from visible progress tracking
- **Tests must pass** - No exceptions (`bun test`)

---

**For complete guidance:** See [`AI_INSTRUCTIONS.md`](../AI_INSTRUCTIONS.md)

**Last Updated:** 2025-11-24
