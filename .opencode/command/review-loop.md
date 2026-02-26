---
description: Automated PR review loop with @review agent and GitHub Copilot until both approve
agent: build
---

# Automated PR Review Loop

You are orchestrating an automated PR review loop that alternates between the @review agent and GitHub Copilot until both approve the changes.

## Arguments

- `$ARGUMENTS` - Optional PR number. If not provided, auto-detect from current branch.

## Setup Phase

1. **Get PR context**:
   ```bash
   # If $ARGUMENTS provided, use that as PR number
   # Otherwise, auto-detect from current branch
   gh pr view $ARGUMENTS --json number,url,title,headRefName,state -q '{number: .number, url: .url, title: .title, branch: .headRefName, state: .state}'
   ```

2. **Validate**:
   - PR must exist
   - PR must be OPEN
   - Current branch must match PR branch (if auto-detected)
   - All tests must pass: `npm test`

3. **Announce start**:
   ```
   🔄 Starting review loop for PR #<number>
   📋 Title: <title>
   🔗 URL: <url>
   ⚙️  Max iterations: 3
   ```

## Review Loop

Execute up to **3 iterations**. Each iteration:

### Step 1: @review Agent Review

Use the Task tool to invoke the `review` subagent with this prompt:

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

End your review with EXACTLY one of:
- "APPROVED: All changes look good" (if no issues found)
- "CHANGES REQUESTED: [specific issues]" (if issues found)
```

**Parse the response**:
- If contains "APPROVED: All changes look good" → `review_approved = true`
- If contains "CHANGES REQUESTED:" → `review_approved = false`, extract issues

### Step 2: Implement @review Recommendations

**Only if** `review_approved = false`:

1. Analyze the requested changes
2. Implement the fixes using Edit/Write tools
3. Run tests: `npm test` (must pass)
4. Commit: `git commit -am "fix: implement @review feedback (iteration <N>)"`
5. Push: `git push`

**If** `review_approved = true`:
- Skip to Step 3

### Step 3: GitHub Copilot Review

Request Copilot review of the PR:

```bash
# Get Copilot's review
gh pr review <number> --comment --body "Please review this PR for code quality, best practices, and potential issues."
```

Wait 5 seconds, then check for Copilot comments:

```bash
gh pr view <number> --comments --json comments -q '.comments[] | select(.author.login == "github-copilot") | {body: .body, createdAt: .createdAt}' | tail -1
```

**Parse Copilot's response**:
- If no new comments or contains "LGTM" or "looks good" → `copilot_approved = true`
- Otherwise → `copilot_approved = false`, extract suggestions

### Step 4: @review Re-evaluates Copilot Suggestions

**Only if** `copilot_approved = false`:

Use Task tool to invoke `review` subagent:

```
GitHub Copilot provided these suggestions:

<copilot_feedback>

As the senior reviewer:
1. Do you agree with these suggestions?
2. Which ones should be implemented?
3. Are any suggestions unnecessary or incorrect?

If changes should be made, specify exactly what to change and why.
End with "IMPLEMENT: <specific changes>" or "IGNORE: <reasoning>".
```

If response contains "IMPLEMENT:":
1. Make the agreed-upon changes
2. Run tests: `npm test`
3. Commit: `git commit -am "fix: address copilot suggestions (iteration <N>)"`
4. Push: `git push`

### Step 5: Check Exit Conditions

**Exit loop if ANY of**:
- ✅ `review_approved = true` AND `copilot_approved = true`
- ⚠️  Iteration count >= 3
- ❌ Tests failed and cannot be fixed

Otherwise, continue to next iteration.

## Final Summary

Report:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Review Loop Complete

Total iterations: <N>
Final status: <status>

@review agent: <approved/not approved>
GitHub Copilot: <approved/not approved>

Changes made: <N> commits
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔗 PR: <url>
```

Status can be:
- ✅ "Both agents approved - ready to merge!"
- ⚠️  "Max iterations reached - manual review needed"
- ❌ "Tests failed - manual intervention required"

## Error Handling

- If PR not found: "❌ No PR found for current branch. Create a PR first or pass PR number as argument."
- If tests fail: Try to fix once, then report error
- If git operations fail: Report exact error and exit
- If agent invocation fails: Report error and continue to next step

## Important Rules

- NEVER skip test runs after making changes
- ALWAYS push changes immediately after committing
- ALWAYS verify PR is still OPEN before each iteration
- Log progress clearly at each step for user visibility
- Save iteration state in comments for debugging
