# OpenCode Custom Commands

This directory contains custom slash commands for OpenCode.

## Available Commands

### Review & Quality

| Command | Description | Usage |
|---------|-------------|-------|
| `/review-loop [pr]` | Automated PR review loop with @review agent and GitHub Copilot | `/review-loop` or `/review-loop 123` |
| `/review [pr]` | Single-pass review using @review agent (no automation) | `/review` or `/review 123` |
| `/review-status` | Check current PR review status | `/review-status` |

### SpecKit Workflow

| Command | Description | Usage |
|---------|-------------|-------|
| `/speckit.specify` | Create feature specification | `/speckit.specify` |
| `/speckit.plan` | Generate implementation plan | `/speckit.plan` |
| `/speckit.tasks` | Break plan into tasks | `/speckit.tasks` |
| `/speckit.implement` | Execute implementation | `/speckit.implement` |
| `/speckit.clarify` | Identify underspecified areas | `/speckit.clarify` |
| `/speckit.checklist` | Generate custom checklist | `/speckit.checklist` |
| `/speckit.analyze` | Cross-artifact consistency analysis | `/speckit.analyze` |
| `/speckit.constitution` | Constitution compliance check | `/speckit.constitution` |
| `/speckit.taskstoissues` | Convert tasks to GitHub issues | `/speckit.taskstoissues` |

## Review Loop Workflow

The `/review-loop` command provides automated code review:

1. **@review agent** reviews PR against:
   - Constitution compliance
   - Pattern adherence  
   - Code quality
   - Security
   - Tests

2. **Auto-implements** recommended changes

3. **GitHub Copilot** provides additional review

4. **@review re-evaluates** Copilot's suggestions

5. **Repeats** until both approve (max 3 iterations)

See `docs/REVIEW_LOOP.md` for complete documentation.

## Creating Custom Commands

To create a new command:

1. Create a markdown file: `.opencode/command/my-command.md`

2. Add frontmatter:
```markdown
---
description: What the command does
agent: build  # or plan, or custom agent
model: anthropic/claude-sonnet-4-20250514  # optional
---

Your command prompt here...
```

3. Use placeholders:
   - `$ARGUMENTS` - All arguments
   - `$1`, `$2`, etc. - Individual arguments
   - `!`command`` - Shell command output
   - `@filename` - File content

4. Invoke with: `/my-command`

See [OpenCode Commands documentation](https://opencode.ai/docs/commands) for details.

## Example: Review Loop Usage

```bash
# On feature branch with PR
/review-loop

# What happens:
# 1. @review checks code
# 2. Fixes issues automatically
# 3. Copilot reviews
# 4. @review evaluates Copilot feedback
# 5. Iterates until approved

# Check status
/review-status

# Merge when ready
gh pr merge
```

## Tips

- Use `/review` first for quick feedback before full automation
- `/review-status` shows progress without triggering reviews
- Max 3 iterations prevents runaway loops
- All commands auto-detect PR from current branch
- Pass PR number if needed: `/review-loop 123`

## Learn More

- **Review workflow**: `docs/REVIEW_LOOP.md`
- **SpecKit workflow**: `docs/SPECKIT_WORKFLOW.md`
- **OpenCode docs**: https://opencode.ai/docs/commands
