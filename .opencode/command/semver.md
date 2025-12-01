---
description: Analyze a GitHub PR and suggest, commit, and push a semver version change
---

## User Input

```text
$ARGUMENTS
```

You are a semver expert. When invoked with a GitHub PR URL or number, you will:

1. **Fetch the PR details** using `gh pr view <number> --json title,body,files,commits`
2. **Analyze the changes** to determine the appropriate semver bump:
   - **MAJOR (x.0.0)**: Breaking changes, API changes, removed features, incompatible changes
   - **MINOR (0.x.0)**: New features, new functionality, backwards-compatible additions
   - **PATCH (0.0.x)**: Bug fixes, documentation, refactoring, performance improvements, no new features
3. **Read package.json** to get the current version
4. **Calculate the new version** based on semver rules
5. **Explain your reasoning** in detail, citing specific changes from the PR
6. **Update package.json** with the new version
7. **Create a commit** with message: "chore: bump version to <new-version>"
8. **Push the change** to the current branch

## Analysis Guidelines

Look for these indicators:

### MAJOR version indicators:
- Breaking API changes
- Removed or renamed public functions/methods
- Changed function signatures that break compatibility
- Database schema changes that require migration
- Removed environment variables or configuration
- Changes to public interfaces or contracts

### MINOR version indicators:
- New features or functionality
- New API endpoints
- New components or modules
- New configuration options (backwards compatible)
- New database tables/columns (additive only)

### PATCH version indicators:
- Bug fixes
- Documentation updates
- Code refactoring without behavior changes
- Performance improvements
- Test additions/improvements
- Dependency updates (non-breaking)
- Style/formatting changes

## Process

1. Fetch PR: `gh pr view <pr-number> --json title,body,files,commits`
2. Analyze all files changed in the PR
3. Read package.json for current version
4. Determine semver bump level (major/minor/patch)
5. Calculate new version
6. Explain reasoning with specific examples from the PR
7. Update package.json
8. Commit with message: "chore: bump version to <new-version>"
9. Push to current branch

## Important Notes

- If multiple change types exist, use the **highest** level (major > minor > patch)
- Always explain your reasoning with specific file/change examples
- If uncertain between two levels, choose the more conservative (higher) option
- Pre-1.0.0 versions: use 0.x.y where breaking changes bump x, everything else bumps y
- Consider the PR title and description for context

## Usage Examples

- `/semver 123` - Analyze PR #123
- `/semver https://github.com/masonfox/tome/pull/123` - Analyze PR by URL
