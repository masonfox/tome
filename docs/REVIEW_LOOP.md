# Automated PR Review Loop

## Overview

An automated review system that uses two AI agents to iteratively review and improve PRs until both agents approve:

1. **@review agent** - Comprehensive full-stack code reviewer (checks constitution, patterns, quality, security)
2. **GitHub Copilot** - Additional review perspective via GitHub CLI

## Commands

### `/review-loop [pr-number]`

**Full automated review loop** that alternates between @review agent and GitHub Copilot for up to 3 iterations.

**Usage**:
```bash
# Auto-detect PR from current branch
/review-loop

# Specify PR number
/review-loop 123
```

**What it does**:
1. @review agent reviews the PR
2. Implements recommended changes (if any)
3. Requests GitHub Copilot review
4. @review re-evaluates Copilot suggestions
5. Implements agreed-upon changes
6. Repeats until both approve or max iterations reached

**Exit conditions**:
- ✅ Both agents approve
- ⚠️  Max iterations reached (3)
- ❌ Tests fail

### `/review [pr-number]`

**Single-pass review** using @review agent only. No automation, no changes made.

**Usage**:
```bash
# Quick review of current PR
/review

# Review specific PR
/review 123
```

Use this when you want feedback without automated implementation.

### `/review-status`

**Check PR status** without triggering any reviews.

**Usage**:
```bash
/review-status
```

Shows:
- Review decision
- Status checks
- Recent comments
- Recent commits

## Workflow Example

### Scenario: You've finished a feature and want comprehensive review

```bash
# 1. Create PR from your feature branch
git checkout feature/my-feature
gh pr create --base develop --title "Add new feature"

# 2. Run automated review loop
/review-loop

# The system will:
# - @review checks constitution, patterns, code quality
# - Fixes issues automatically
# - Gets Copilot's perspective  
# - Iterates until both approve

# 3. Check final status
/review-status

# 4. Merge when approved
gh pr merge
```

### Scenario: Quick feedback before implementing changes

```bash
# Just want to see what @review thinks
/review

# Read feedback, implement changes manually
# Push changes
git push

# Run full loop when ready
/review-loop
```

## @review Agent Capabilities

The @review agent is a principal full-stack code reviewer that checks:

### Code Quality & Architecture
- Code structure, design patterns, architectural decisions
- Separation of concerns, modularity, maintainability
- Error handling and edge case coverage
- Performance implications and scalability

### Security Review
- Security vulnerabilities (XSS, SQL injection, CSRF, auth flaws)
- Data validation and sanitization
- API security, authentication, authorization
- Sensitive data exposure and encryption

### Full-Stack Integration
- Frontend-backend API contracts and data flow
- State management and data synchronization
- Database schema design and query optimization
- Caching strategies and data consistency

### Best Practices & Standards
- Language-specific conventions and framework best practices
- Code comments, documentation, type safety
- Testing coverage and test quality
- Accessibility, SEO, cross-browser compatibility

### Project-Specific
- Constitution compliance (`.specify/memory/constitution.md`)
- Pattern adherence (`.specify/memory/patterns.md`)
- Repository pattern enforcement
- Test isolation patterns

## Review Format

The @review agent structures feedback as:

1. **Summary** - Brief overview of code quality and concerns
2. **Best Practices** - Framework-specific optimizations
3. **Positive Notes** - Well-implemented aspects
4. **Improvements** - Code quality and maintainability suggestions
5. **Critical Issues** - Security vulnerabilities, bugs, architectural problems

## Approval Signals

### @review Agent
- ✅ Approved: Response contains "APPROVED: All changes look good"
- ❌ Changes requested: Response contains "CHANGES REQUESTED:"

### GitHub Copilot
- ✅ Approved: No critical suggestions or contains "LGTM"/"looks good"
- ❌ Changes requested: Provides specific suggestions

## Safety Features

1. **Max iterations**: Prevents infinite loops (default: 3)
2. **Test verification**: All changes must pass `npm test`
3. **Read-only @review**: Agent cannot directly modify code
4. **Explicit approval**: Both agents must explicitly approve
5. **Push after commit**: Changes immediately pushed to remote

## Troubleshooting

### "No PR found for current branch"
- Ensure you're on a feature branch with an open PR
- Or specify PR number: `/review-loop 123`

### "Tests failed"
- Fix test failures manually
- Re-run `/review-loop` to continue

### "Max iterations reached"
- Review the suggested changes
- Some issues may need manual intervention
- Check `/review-status` for details

### Agent not found
- Verify `~/.opencode/agents/review.md` exists
- Try invoking directly: `@review please review this PR`

## Configuration

### Adjust max iterations

Edit `.opencode/command/review-loop.md` and change:
```markdown
⚙️  Max iterations: 3
```

### Customize @review agent

Edit `~/.opencode/agents/review.md` to adjust:
- Review criteria
- Output format
- Approval signals
- Tool permissions

## Integration with Existing Workflow

This complements your existing SpecKit workflow:

```bash
# Existing: Feature development
/speckit.specify
/speckit.plan
/speckit.implement

# New: Automated review
git push
gh pr create --base develop
/review-loop

# Existing: Merge when ready
gh pr merge
```

## Tips

1. **Start with `/review`** for quick feedback before committing to full loop
2. **Use `/review-status`** to check progress mid-loop
3. **Interrupt with Ctrl+C** if needed - safe to re-run
4. **Max 3 iterations** prevents runaway automation
5. **Both agents must approve** ensures high quality

## Future Enhancements

Potential improvements:
- Resume capability after interruption
- Configurable iteration limits per PR
- Multiple reviewer agents (security, performance, etc.)
- Integration with GitHub Actions
- Slack/Discord notifications on completion
- Review history tracking
