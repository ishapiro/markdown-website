#!/bin/bash
# Recreates the local D1 database from scratch and re-imports all content.
#
# Usage:
#   chmod +x recreate-db.sh
#   ADMIN_PASSWORD=yourpassword ./recreate-db.sh
#
# The dev server does NOT need to be running when you start this script.
# The script will pause and ask you to start/restart it at the right moment.

set -e

DB_NAME="cogitations-db"

echo "=== Step 1: Stop your dev server now (Ctrl+C in its terminal) ==="
read -p "Press Enter when the dev server is stopped..."

echo ""
echo "=== Step 2: Wipe local D1 state ==="
rm -rf .wrangler/state/v3/d1
echo "Done."

echo ""
echo "=== Step 3: Apply migrations ==="
npx wrangler d1 execute "$DB_NAME" --local --file=drizzle/0000_blushing_slapstick.sql
echo "  ✓ 0000_blushing_slapstick (tables)"
npx wrangler d1 execute "$DB_NAME" --local --file=drizzle/0001_add_sort_order.sql
echo "  ✓ 0001_add_sort_order"
npx wrangler d1 execute "$DB_NAME" --local --file=drizzle/0002_add_show_date.sql
echo "  ✓ 0002_add_show_date"

echo ""
echo "=== Step 4: Import images ==="
node migrate-images.mjs

echo ""
echo "=== Step 5: Start the dev server ==="
echo "Run 'npm run dev' in another terminal, wait for 'Ready on http://localhost:3001'"
read -p "Press Enter when the server is ready..."

echo ""
echo "=== Step 6: Import pages ==="
ADMIN_PASSWORD="$ADMIN_PASSWORD" node migrate.mjs

echo ""
echo "=== Done! ==="
