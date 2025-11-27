---
description: Process a GitHub issue end-to-end with the github-issue-processor agent
---

Use the github-issue-processor agent to handle the complete workflow:

IMPORTANT: Pass the GitHub issue URL or number to process:
- Example: "Process issue #19"
- Example: "Handle https://github.com/masonfox/tome/issues/19"

The agent will:
1. Read the issue using gh CLI
2. Explore the codebase for context
3. Build an implementation plan
4. Execute the changes
5. Create a feature branch
6. Commit and push the changes

Please provide the GitHub issue URL or issue number to process.
