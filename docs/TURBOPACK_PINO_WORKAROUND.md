# Turbopack + Bun + Pino Compatibility Workaround

## Issue

Next.js 16 with Turbopack has compatibility issues with pino logger when running with Bun runtime:

- **Error**: `Failed to load external module pino-*: BuildMessage: EISDIR reading "/app/.next/node_modules/pino-*"`
- **Root Cause**: Turbopack's dynamic module analysis cannot handle pino's worker thread dynamic requires
- **Upstream Issue**: [Next.js #86099](https://github.com/vercel/next.js/issues/86099) (still open)
- **Affects**: Turbopack + Bun/Vercel deployments specifically

## Current Workaround (Phase 1)

**Status**: ✅ Implemented (Jan 2026)

We've switched to **Webpack** bundler to avoid Turbopack issues:

```json
// package.json
{
  "scripts": {
    "dev": "next dev --webpack",
    "build": "next build --webpack"
  }
}
```

### Changes Made

1. **package.json**: Added `--webpack` flag to dev and build scripts
2. **tailwind.config.ts**: Converted from `require()` to ESM `import` for webpack compatibility

### Trade-offs

- ✅ **Pros**: Pino works perfectly, production deployments stable
- ⚠️ **Cons**: Slightly slower build times compared to Turbopack (acceptable trade-off)

## Future Solution (Phase 2)

**Status**: 🔄 Planned

### Option A: Wait for Turbopack Fix
- Monitor [Next.js #86099](https://github.com/vercel/next.js/issues/86099)
- Revert to Turbopack once fixed
- **ETA**: Unknown (issue open since Nov 2025)

### Option B: Migrate to Consola Logger (Recommended)
- **Why**: Used by Vercel internally, zero Turbopack issues
- **When**: Next sprint/maintenance window
- **Effort**: 2-3 hours
- **Benefits**: Future-proof for when Turbopack becomes mandatory

## Testing

Both development and production builds verified working:

```bash
# Development
bun run dev
# ✅ Starts on http://localhost:3000

# Production Build
bun run build
# ✅ Compiles successfully

# Production Server
bun run start
# ✅ Starts without pino errors
```

## References

- [Next.js Issue #86099](https://github.com/vercel/next.js/issues/86099) - Turbopack + Pino worker thread issues
- [Next.js Issue #86866](https://github.com/vercel/next.js/issues/86866) - Turbopack + Bun external module loading
- [Pino Bundling Docs](https://github.com/pinojs/pino/blob/main/docs/bundling.md) - Official pino bundling limitations

## Related Files

- `package.json` - Build script configuration
- `tailwind.config.ts` - ESM import fix
- `lib/logger.ts` - Pino logger configuration
- `instrumentation.ts` - Calibre watcher initialization

---

**Last Updated**: January 5, 2026  
**Next Review**: After Next.js 16.2 release or Phase 2 implementation
