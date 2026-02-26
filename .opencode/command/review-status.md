---
description: Check review status of current PR
agent: build
---

# Review Status Check

Quick status check for the current PR's review state.

## Process

1. **Get PR info**:
   ```bash
   gh pr view --json number,url,title,reviewDecision,statusCheckRollup,commits -q '{number: .number, url: .url, title: .title, reviewDecision: .reviewDecision, checks: .statusCheckRollup, commitCount: (.commits | length)}'
   ```

2. **Get recent comments** (last 5):
   ```bash
   gh pr view --comments --json comments -q '.comments[-5:] | .[] | {author: .author.login, body: .body, createdAt: .createdAt}'
   ```

3. **Get recent commits** (last 5):
   ```bash
   git log -5 --oneline HEAD
   ```

4. **Summary**:
   ```
   📊 PR #<number> Review Status
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Title: <title>
   Review Decision: <decision>
   Status Checks: <passing/failing>
   Recent Commits: <count>
   
   🔗 <url>
   ```

This gives you a quick snapshot without triggering any reviews or changes.
