#!/bin/bash
# Run Signal Desktop with Terminal Mode (Production Environment)

echo "🚀 Starting Signal Desktop with Terminal Mode..."
echo ""
echo "Step 1: Installing dependencies..."
pnpm install

echo ""
echo "Step 2: Building the application..."
pnpm run generate

echo ""
echo "Step 3: Starting Signal Desktop (Production Mode)..."
echo "Terminal mode is ENABLED by default!"
echo ""
echo "⌨️  Try these shortcuts once it's running:"
echo "  j/k     - Navigate conversations"
echo "  e       - Archive (Done)"
echo "  Cmd+K   - Command palette"
echo "  n       - Add note"
echo ""

# Run with production environment to connect to real Signal servers
SIGNAL_ENV=production pnpm start
