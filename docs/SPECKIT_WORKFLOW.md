# SpecKit Workflow Guide

**How to use SpecKit for structured feature development in Tome**

---

## What is SpecKit?

SpecKit is a structured workflow for feature development that:
- Creates consistent feature specifications
- Validates against project constitution
- Generates implementation plans
- Breaks work into actionable tasks
- Maintains documentation automatically

**Benefits:**
- Consistent feature documentation
- Constitution compliance checks
- Clear implementation roadmap
- Reduced scope creep
- Better collaboration

---

## Workflow Overview

```
Feature Idea
    ↓
/speckit.specify → Creates specification
    ↓
/speckit.plan → Generates implementation plan (with constitution checks)
    ↓
/speckit.tasks → Breaks down into tasks
    ↓
/speckit.implement → Executes implementation (or manual implementation)
    ↓
Feature Complete ✅
```

---

## Step 1: Create Specification

**Command:** `/speckit.specify [feature description]`

**Input:** Natural language description of the feature

**Output:** Creates `specs/###-feature-name/spec.md`

**Example:**
```
/speckit.specify Add ability to filter library by publication year
```

**Generated spec includes:**
- User Stories (prioritized P1, P2, P3...)
- Functional Requirements
- Success Criteria
- Edge Cases

**What to review:**
- Are user stories independently testable?
- Are requirements clear and measurable?
- Are success criteria achievable?

---

## Step 2: Generate Implementation Plan

**Command:** `/speckit.plan`

**Input:** Reads `spec.md` from current feature

**Output:** Creates `plan.md` with:
- Technical context (tech stack, dependencies)
- **Constitution Check** (validates against `.specify/memory/constitution.md`)
- Project structure
- Complexity tracking

**Example Constitution Check:**
```markdown
## Constitution Check

- [ ] Data Integrity First: Uses repositories? Follows Database Factory Pattern?
- [ ] Layered Architecture: Routes → Services → Repositories?
- [ ] Self-Contained: No external dependencies?
- [ ] UX Standards: Smart defaults? Temporal validation?
- [ ] Observability: Pino logging? Real database tests?
```

**What to review:**
- Are all constitution checks passing?
- Is the technical approach sound?
- Any violations justified?

---

## Step 3: Break into Tasks

**Command:** `/speckit.tasks`

**Input:** Reads `spec.md` and `plan.md`

**Output:** Creates `tasks.md` with:
- Phase 1: Setup
- Phase 2: Foundational (blocking prerequisites)
- Phase 3+: User Stories (independently implementable)
- Dependency tracking
- Parallel execution opportunities

**Example:**
```markdown
## Phase 2: Foundational

- [ ] T001 Create PublicationYearFilter repository method
- [ ] T002 Add year filter to BookRepository.findWithFilters

## Phase 3: User Story 1 - Filter by Year (P1)

- [ ] T003 [P] [US1] Add year filter UI component
- [ ] T004 [P] [US1] Wire filter to API query params
- [ ] T005 [US1] Test filtering with real database
```

**Task Markers:**
- `[P]` = Can run in parallel
- `[US1]` = Belongs to User Story 1

---

## Step 4: Implement

**Option A: Manual Implementation**
- Work through tasks in dependency order
- Mark todos as you go
- Test each user story independently
- Run `bun test` before marking complete

**Option B: Automated Implementation**
- `/speckit.implement` - Executes tasks automatically
- Reviews each task before proceeding
- Runs tests after each phase
- Creates commits

---

## Additional Commands

### `/speckit.clarify`
**Purpose:** Identify underspecified areas in spec

**When to use:**
- Spec feels ambiguous
- Edge cases unclear
- Requirements vague

**Output:** Asks up to 5 targeted clarification questions and updates spec

---

### `/speckit.checklist`
**Purpose:** Generate custom checklist for feature

**When to use:**
- Need QA checklist
- Need deployment checklist
- Need review checklist

**Output:** Creates custom checklist in `specs/###-feature-name/checklist.md`

---

### `/speckit.analyze`
**Purpose:** Cross-artifact consistency analysis

**When to use:**
- After task generation
- Before implementation
- After major spec changes

**Output:** Reports on:
- Spec ↔ Plan consistency
- Plan ↔ Tasks alignment
- Constitution compliance gaps
- Missing requirements

---

## Best Practices

### 1. Start with Constitution

**Before creating spec:**
- Read `.specify/memory/constitution.md`
- Understand the 5 core principles
- Know what's allowed/disallowed

### 2. Keep User Stories Independent

**Each user story should:**
- Be implementable alone
- Be testable alone
- Deliver value alone
- Not block other stories

**Bad:**
```
US1: Add filter infrastructure (no value alone)
US2: Add year filter (depends on US1)
```

**Good:**
```
US1 (P1): Add year filter (complete feature)
US2 (P2): Add author filter (complete feature)
```

### 3. Constitution Checks are Gates

**Don't skip constitution checks!**

If a check fails:
- Rethink the approach, OR
- Document the violation with justification

**Example violation with justification:**
```
❌ Self-Contained: Requires Redis for caching

**Justification:**
Current SQLite approach cannot handle 100k+ concurrent users (performance requirement SC-002).
Redis chosen because:
- Self-hosted (Docker Compose)
- Minimal config overhead
- Industry standard for caching

**Mitigation:**
- Include Redis in docker-compose.yml
- Document setup in README.md
- Ensure fallback to no-cache mode
```

### 4. Test Each User Story

**After implementing a user story:**
- Run tests: `bun test`
- Manual test the user journey
- Verify constitution compliance
- Demo if possible

**Before moving to next story:**
- Ensure current story works independently
- No breaking changes to previous stories
- Tests pass

---

## File Structure

After running SpecKit for a feature:

```
specs/001-feature-name/
├── spec.md              # Feature specification
├── plan.md              # Implementation plan
├── tasks.md             # Task breakdown
├── research.md          # Optional: Research notes
├── data-model.md        # Optional: Data models
├── contracts/           # Optional: API contracts
└── checklist.md         # Optional: Custom checklist
```

---

## Integration with Constitution

SpecKit automatically validates against:

**Constitution** (`.specify/memory/constitution.md`):
- Data Integrity First
- Layered Architecture Pattern
- Self-Contained Deployment
- User Experience Standards
- Observability & Testing

**Patterns** (`.specify/memory/patterns.md`):
- References patterns by name
- Validates pattern usage
- Suggests appropriate patterns

**Architecture** (`docs/ARCHITECTURE.md`):
- Validates layer structure
- Checks file organization
- Ensures tech stack consistency

---

## Example: Full Workflow

**Feature:** Add publication year filter to library

### 1. Specify
```
/speckit.specify Add ability to filter library by publication year with range support (e.g., 2020-2023)
```

**Output:**
- Creates `specs/001-year-filter/spec.md`
- Generates 2 user stories (exact filter, range filter)
- Defines success criteria (filter works, persists in URL)

### 2. Plan
```
/speckit.plan
```

**Output:**
- Creates `plan.md`
- Constitution check passes (uses repositories, no external deps)
- Identifies needed: Repository method, API route update, UI component

### 3. Tasks
```
/speckit.tasks
```

**Output:**
- Creates `tasks.md`
- Phase 1: Setup (project structure)
- Phase 2: Foundational (repository method)
- Phase 3: US1 - Exact year filter (P1)
- Phase 4: US2 - Year range filter (P2)

### 4. Implement
Work through tasks:
- T001-T003: Add repository method
- T004-T007: Implement US1 (exact filter)
- Test US1 independently ✅
- T008-T010: Implement US2 (range filter)
- Test US2 independently ✅
- All tests pass ✅

### 5. Ship
- Feature complete
- Both user stories work
- Tests passing
- Documentation updated

---

## When NOT to Use SpecKit

**Skip SpecKit for:**
- Bug fixes (just fix it)
- Trivial changes (1-2 line changes)
- Documentation updates
- Dependency updates
- Refactoring without new features

**Use SpecKit for:**
- New features
- Major refactorings
- Architecture changes
- Multi-step enhancements
- Anything requiring planning

---

## Troubleshooting

### "Constitution check failing"

**Problem:** Plan shows constitution violations

**Solution:**
1. Re-read constitution (`.specify/memory/constitution.md`)
2. Adjust approach to comply, OR
3. Document violation with justification

### "Tasks unclear or vague"

**Problem:** Generated tasks not actionable

**Solution:**
1. Run `/speckit.clarify` to improve spec
2. Add more detail to spec.md manually
3. Re-run `/speckit.tasks`

### "User stories feel dependent"

**Problem:** Can't implement US2 without US1

**Solution:**
1. Rethink user story breakdown
2. Each story should deliver standalone value
3. Move shared code to "Foundational" phase

---

## Quick Reference

| Command | Purpose | Input | Output |
|---------|---------|-------|--------|
| `/speckit.specify` | Create spec | Feature description | `spec.md` |
| `/speckit.plan` | Generate plan | `spec.md` | `plan.md` |
| `/speckit.tasks` | Break into tasks | `spec.md` + `plan.md` | `tasks.md` |
| `/speckit.clarify` | Improve spec | `spec.md` | Updated `spec.md` |
| `/speckit.checklist` | Custom checklist | `spec.md` | `checklist.md` |
| `/speckit.analyze` | Consistency check | All artifacts | Analysis report |
| `/speckit.implement` | Auto-implement | `tasks.md` | Code changes |

---

**For more details:**
- Constitution: `.specify/memory/constitution.md`
- Patterns: `.specify/memory/patterns.md`
- Architecture: `docs/ARCHITECTURE.md`
- Universal AI Guide: `AI_INSTRUCTIONS.md`

**Last Updated:** 2025-11-24
