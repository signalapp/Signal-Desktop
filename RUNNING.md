# How to Run Signal Desktop with Terminal Mode

## 🎯 TL;DR - Fastest Way

```bash
# One command to rule them all
./run-terminal-mode.sh
```

Or manually:
```bash
pnpm install      # Install dependencies
pnpm run generate # Build the app
pnpm start        # Run Signal Desktop
```

---

## 📋 Step-by-Step Guide

### 1. Install Dependencies

Signal Desktop uses `pnpm` (not npm):

```bash
pnpm install
```

This will:
- Install all Node.js dependencies
- Build acknowledgments
- Install Electron app dependencies

**⏱️ Takes ~5-10 minutes on first run**

### 2. Build the Application

```bash
pnpm run generate
```

This compiles:
- TypeScript → JavaScript
- SCSS → CSS (including your new terminal theme!)
- Protobuf definitions
- ICU types
- All other assets

**⏱️ Takes ~2-5 minutes**

### 3. Start Signal Desktop

```bash
pnpm start
```

This launches the Electron app with terminal mode enabled by default!

---

## 🔧 Development Mode (With Hot Reload)

For active development with auto-rebuild:

### Terminal 1: Watch TypeScript & Styles
```bash
pnpm run dev:transpile
```

### Terminal 2: Watch Styles (Optional)
```bash
pnpm run dev:styles
```

### Terminal 3: Run the App
```bash
pnpm start
```

Now your changes will auto-rebuild when you save files!

---

## ⚡ Quick Commands

| Command | What it does |
|---------|--------------|
| `pnpm start` | Run Signal Desktop |
| `pnpm run generate` | Full build |
| `pnpm run dev:transpile` | Watch mode for TypeScript |
| `pnpm run dev:styles` | Watch mode for SCSS |
| `pnpm run check:types` | TypeScript type checking |
| `pnpm run lint` | Run all linters |

---

## 🎨 Accessing Terminal Mode Features

### On First Launch:

Terminal mode is **enabled by default**! You'll see:
- Dark Bloomberg-style theme
- Monospace fonts
- Compact conversation list

### Keyboard Shortcuts (Ready to Use):

| Shortcut | Action |
|----------|--------|
| `j` / `k` | Navigate conversations |
| `e` | Archive (Done) |
| `Cmd+K` or `Ctrl+K` | Command palette |
| `n` | Add note to conversation |
| `s` | Star/Pin conversation |
| `u` | Next unread |
| `?` | Show all shortcuts |

### Settings:

If you want to configure or disable terminal mode:

1. Open Signal Desktop
2. Click Settings (gear icon)
3. Look for "Terminal Mode Settings" section
4. Toggle features on/off
5. Customize keybindings

---

## 🐛 Troubleshooting

### "pnpm: command not found"

Install pnpm first:
```bash
npm install -g pnpm@10.18.1
```

### Build Errors

Clear everything and start fresh:
```bash
rm -rf node_modules
rm -rf build
pnpm install
pnpm run generate
```

### Electron Won't Start

Make sure you're in the project directory:
```bash
cd /home/user/Signal-Desktop-test
pnpm start
```

### Terminal Mode Not Showing

Terminal mode is enabled by default. If you don't see it:

1. Check the Redux state in DevTools:
   - Open Signal Desktop
   - Press `Cmd+Option+I` (Mac) or `Ctrl+Shift+I` (Windows/Linux)
   - Console tab: `window.reduxStore.getState().terminal`
   - Should show `terminalMode: true`

2. Check the CSS is loaded:
   - Open DevTools → Elements tab
   - Look for `<body class="terminal-mode">`

### Keybindings Not Working

1. Make sure focus is on the conversation list (not in a text input)
2. Check DevTools console for errors
3. Verify terminal mode is enabled
4. Try clicking on the conversation list area first

---

## 💻 System Requirements

- **Node.js**: 20.x or later
- **pnpm**: 10.18.1
- **RAM**: 4GB minimum, 8GB recommended
- **OS**: macOS, Windows, or Linux
- **Disk**: ~2GB for dependencies + build

---

## 📝 Development Tips

### Fast Iteration

1. Keep `pnpm run dev:transpile` running in background
2. Make changes to TypeScript/SCSS files
3. Wait for rebuild (watch logs)
4. Restart Signal Desktop (`Cmd+R` or `Ctrl+R` to reload)

### Debugging Terminal Mode

Check the Redux state:
```javascript
// In DevTools console
window.reduxStore.getState().terminal

// Check keybindings
window.reduxStore.getState().terminal.keybindings

// Check notes
window.reduxStore.getState().terminal.conversationNotes
```

### Testing Keybindings

```javascript
// In DevTools console - simulate key press
document.dispatchEvent(new KeyboardEvent('keydown', { key: 'j' }))
```

---

## 🎯 What's Different from Normal Signal?

When you run this version, you'll immediately notice:

✅ **Dark terminal theme** - Bloomberg-inspired colors
✅ **Superhuman shortcuts** - `j/k` navigation, `Cmd+K` command palette
✅ **Notes feature** - Press `n` to add notes to any conversation
✅ **Compact view** - More conversations on screen
✅ **Monospace fonts** - Terminal-style typography

Everything else works exactly like regular Signal Desktop!

---

## 🚀 Ready to Go!

Just run:
```bash
./run-terminal-mode.sh
```

Or:
```bash
pnpm install && pnpm run generate && pnpm start
```

Enjoy your Bloomberg terminal-style Signal experience! 🎉

For full keyboard shortcuts, see [TERMINAL_MODE.md](./TERMINAL_MODE.md)
