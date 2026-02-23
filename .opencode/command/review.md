---
description: Quick PR review using @review agent (single pass, no automation)
agent: build
---

# Single PR Review

Perform a one-time comprehensive code review using the @review agent.

## Arguments

- `$ARGUMENTS` - Optional PR number. If not provided, auto-detect from current branch.

## Process

1. **Get PR context**:
   ```bash
   gh pr view $ARGUMENTS --json number,url,title,headRefName,state -q '{number: .number, url: .url, title: .title, branch: .headRefName, state: .state}'
   ```

2. **Invoke @review agent** using Task tool:

```
Review the current changes in this PR.

PR Context:
- Number: #<number>
- Branch: <branch>
- Title: <title>

Focus on:
1. Constitution compliance (.specify/memory/constitution.md)
2. Pattern adherence (.specify/memory/patterns.md)  
3. Code quality and maintainability
4. Security vulnerabilities
5. Test coverage
6. Performance implications

Review the diff:
!`git diff develop...HEAD`

Provide a comprehensive review following your standard format.
```

3. **Display results** to user

This command does NOT make any changes or loop - it's just a single review pass for quick feedback.

To implement the recommendations, either:
- Manually make the changes
- Use `/review-loop` for automated implementation and iteration
