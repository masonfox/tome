#!/bin/bash
set -e

# Database Reset Script
#
# Resets the Tome development database by:
# 1. Deleting the entire data/ directory
# 2. Recreating the data/ directory
# 3. Running database migrations
# 4. Optionally running the seeder
#
# ⚠️  DEVELOPMENT ONLY - NEVER run this in production!
#
# Usage:
#   bash scripts/reset-database.sh
#   npm run db:reset

# Color codes for better UX
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DATA_DIR="${DATA_DIR:-./data}"

echo ""
echo "=== Database Reset Utility ==="
echo ""

# Display prominent warnings
echo -e "${RED}⚠️  WARNING: This will DELETE the entire data/ directory!${NC}"
echo -e "${RED}⚠️  DEVELOPMENT ONLY - NEVER run this in production!${NC}"
echo ""
echo "   This includes:"
echo "   - tome.db (main database)"
echo "   - Any WAL/SHM files"
echo "   - All backups in data/backups/"
echo "   - Any other files in data/"
echo ""

# Show current data directory contents if it exists
if [ -d "$DATA_DIR" ]; then
	echo -e "${BLUE}Current contents of data/:${NC}"
	if [ "$(ls -A "$DATA_DIR" 2>/dev/null)" ]; then
		ls -lh "$DATA_DIR" 2>/dev/null | tail -n +2 | head -20
		# Count total items
		ITEM_COUNT=$(ls -A "$DATA_DIR" 2>/dev/null | wc -l)
		if [ "$ITEM_COUNT" -gt 20 ]; then
			echo "   ... and $((ITEM_COUNT - 20)) more items"
		fi
	else
		echo "   (empty directory)"
	fi
	echo ""
else
	echo -e "${BLUE}Note: data/ directory does not currently exist${NC}"
	echo ""
fi

# Confirmation prompt - must type "yes" exactly
echo -e "${YELLOW}❓ Are you sure you want to continue? (yes/no):${NC} "
read -r CONFIRM

if [ "$CONFIRM" != "yes" ]; then
	echo ""
	echo "❌ Reset cancelled"
	echo ""
	exit 0
fi

echo ""
echo "✅ Confirmed"
echo ""

# Step 1: Delete data directory
echo "🗑️  Removing data/ directory..."
if [ -d "$DATA_DIR" ]; then
	rm -rf "$DATA_DIR"
	echo "✅ Removed data/ directory"
else
	echo "✅ data/ directory did not exist (skipped)"
fi
echo ""

# Step 2: Run database migrations (will create data/ directory automatically)
echo "🔄 Running database migrations..."
echo ""
npm run db:migrate
echo ""
echo "✅ Database schema applied"
echo ""

# Step 3: Prompt for seeder (Y is default)
echo -e "${YELLOW}❓ Run database seeder? [Y/n]:${NC} "
read -r RUN_SEED

# Default to yes if empty or Y/y
if [ -z "$RUN_SEED" ] || [ "$RUN_SEED" = "Y" ] || [ "$RUN_SEED" = "y" ]; then
	echo ""
	echo "🌱 Running database seeder..."
	echo ""
	npm run db:seed
	echo ""
	echo "✅ Seeder complete"
	SEEDER_RAN=true
else
	echo ""
	echo "⏭️  Skipping seeder"
	SEEDER_RAN=false
fi

# Display success summary
echo ""
echo -e "${GREEN}✅ Database reset complete!${NC}"
echo ""
echo "Next steps:"
echo "  • Your database is now clean"
if [ "$SEEDER_RAN" = true ]; then
	echo "  • Sample data has been seeded"
	echo "  • Start dev server: npm run dev"
	echo "  • Or explore the database: npm run db:studio"
else
	echo "  • No sample data (run 'npm run db:seed' to add)"
	echo "  • Or start with a fresh database: npm run dev"
fi
echo ""
