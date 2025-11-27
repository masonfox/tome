# Custom Claude Code Agents

This directory contains custom subagents for specialized workflows in Claude Code.

## GitHub Issue Processor

**File:** `github-issue-processor.md`

### Purpose
Automates the complete development workflow from GitHub issue to committed code on a feature branch.

### What It Does
1. Reads GitHub issues using `gh` CLI
2. Explores the codebase to understand context
3. Builds a detailed implementation plan
4. Executes code changes
5. Creates a feature branch with descriptive name
6. Commits changes with proper message format
7. Pushes branch to remote repository

### How to Use

#### Option 1: Direct Invocation (Recommended)
In Claude Code, simply ask:
```
Use the github-issue-processor agent to handle issue #19
```

Or with a URL:
```
Use the github-issue-processor agent to process https://github.com/masonfox/tome/issues/19
```

#### Option 2: Via Slash Command
```
/process-issue #19
```

Then provide the issue URL or number when prompted.

#### Option 3: Task Tool
```
Use the Task tool with subagent_type='github-issue-processor' and the issue URL
```

### Example Workflow

**Input:**
```
Use the github-issue-processor agent for https://github.com/masonfox/tome/issues/19
```

**Agent Actions:**
1. Runs: `gh issue view 19`
2. Reads issue: "Remove book progress in library"
3. Explores: Finds `BookGrid.tsx` and `BookCard.tsx`
4. Plans: Remove progress prop from BookGrid
5. Implements: Edits BookGrid to remove `latestProgress` and `currentProgress`
6. Creates branch: `git checkout -b remove-library-progress`
7. Commits with message: "Remove book progress display in library\n\nCloses #19\n\n🤖 Generated..."
8. Pushes: `git push -u origin remove-library-progress`
9. Reports: Branch pushed, ready for PR

### Agent Capabilities

**Tools Available:**
- `Read` - Read source files
- `Edit` - Modify existing files
- `Write` - Create new files
- `Bash` - Execute git and gh commands
- `Grep` - Search code patterns
- `Glob` - Find files by pattern
- `Task` - Spawn specialized subagents (like Explore)

**Model:** Claude Sonnet (fast, high-quality)

### Configuration

The agent follows these principles:
- ✅ Minimal, focused changes
- ✅ Match existing code patterns
- ✅ Clear commit messages
- ✅ Descriptive branch names
- ❌ No over-engineering
- ❌ No unnecessary refactoring
- ❌ No changes to unrelated code

### Customization

Edit `.claude/agents/github-issue-processor.md` to:
- Change the system prompt
- Adjust workflow steps
- Add or remove tools
- Switch model (sonnet, opus, haiku)
- Modify branch naming conventions
- Customize commit message format

### Integration with SpecKit

This agent can be combined with your existing SpecKit commands:

**Full Documentation Workflow:**
```
1. /speckit.specify - Create spec from issue
2. /speckit.plan - Build implementation plan
3. /speckit.tasks - Generate task list
4. /speckit.implement - Execute tasks
5. Use github-issue-processor for git workflow
```

**Quick Implementation Workflow:**
```
Use github-issue-processor agent (handles everything)
```

Choose based on complexity and documentation needs.

## Creating Your Own Agents

To create additional custom agents:

1. Create a new markdown file in `.claude/agents/`
2. Add YAML frontmatter with:
   - `name` - Agent identifier
   - `description` - What the agent does
   - `tools` - Available tools (Read, Edit, Bash, etc.)
   - `model` - Claude model (sonnet, opus, haiku)
3. Write the system prompt defining behavior
4. Invoke with: "Use the <name> agent to..."

### Example Template

```markdown
---
name: my-custom-agent
description: Does something specific
tools: Read, Edit, Bash
model: sonnet
---

You are a specialized agent that...

Your responsibilities:
1. First step
2. Second step
3. Third step

Guidelines:
- Important rule 1
- Important rule 2
```

## Learn More

- [Claude Code Subagents Documentation](https://code.claude.com/docs/en/sub-agents)
- [Claude Agent SDK Overview](https://platform.claude.com/docs/en/agent-sdk/overview)
- [Available Tools Reference](https://code.claude.com/docs/en/tools)
