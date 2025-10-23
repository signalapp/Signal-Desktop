# Terminal Mode for Signal Desktop

A Bloomberg terminal-inspired interface for Signal Desktop with efficient keyboard navigation, note-taking, and customizable keybindings.

## Features

### 🎨 Terminal UI Theme

- **Dark Bloomberg-style interface**: Clean, professional dark theme optimized for expert users
- **Monospace fonts**: Consistent typography using SF Mono, Monaco, Fira Code, and other monospace fonts
- **Compact view**: Dense layout showing more conversations on screen
- **High contrast colors**: Easy-to-read text with clear visual hierarchy

### ⌨️ Vim-Style Keyboard Navigation

Navigate Signal like a pro with efficient keyboard shortcuts:

#### Basic Navigation
- `j` / `k` - Move down/up in conversation list
- `gg` - Jump to first conversation (press 'g' twice)
- `G` - Jump to last conversation (Shift+g)
- `u` - Next unread conversation
- `Enter` - Open selected conversation

#### Actions
- `e` - Archive conversation
- `m` - Mute conversation
- `/` - Start search
- `n` - Toggle note for current conversation
- `N` - Edit note (Shift+n)

#### Quick Jump
- `Alt+1` through `Alt+9` - Jump to conversations 1-9

#### Command Palette
- `Ctrl+P` or `:` - Open command palette
- Type commands like `:mute`, `:archive`, `:call`
- Fuzzy search for conversations and actions
- Command history with up/down arrows

### 📝 Conversation Notes

Leave persistent notes next to any conversation:

- **Quick note toggle**: Press `n` to add/edit a note
- **Inline editing**: Notes appear directly in the conversation list
- **Persistent storage**: Notes are saved to the database
- **Visual indicators**: Notes display with a 📝 icon
- **Searchable**: Find conversations by note content (coming soon)

### ⚙️ Customizable Keybindings

Full control over your keyboard shortcuts:

- **Three preset modes**:
  - **Default**: Standard Signal keybindings
  - **Vim**: Full vim-style navigation
  - **Custom**: Define your own shortcuts

- **Visual keybinding editor**: Configure bindings through the UI
- **Conflict detection**: Warns about duplicate bindings
- **Import/Export**: Share keybinding configurations (coming soon)

## Usage

### Enabling Terminal Mode

1. Open Signal Desktop Settings
2. Navigate to "Terminal Mode Settings"
3. Check "Enable Terminal Mode"
4. Optionally enable:
   - Compact View (denser layout)
   - Monospace Fonts (terminal-style typography)

### Configuring Keybindings

1. Go to Settings → Terminal Mode Settings
2. Select keybinding mode:
   - **Vim Mode** (recommended for power users)
   - **Default Mode** (standard shortcuts)
   - **Custom Mode** (define your own)
3. Click "Edit" next to any keybinding to customize
4. Press your desired key combination
5. Click "Reset All" to restore defaults

### Using Notes

**Add a note:**
1. Select a conversation
2. Press `n` (or configured shortcut)
3. Type your note
4. Press `Enter` to save, `Esc` to cancel

**Edit a note:**
1. Select the conversation with a note
2. Press `n` to edit
3. Modify the text
4. Press `Enter` to save

**Delete a note:**
1. Press `n` to edit
2. Clear all text
3. Press `Enter` to save (empty notes are deleted)

### Command Palette

The command palette provides quick access to all Signal actions:

1. Press `Ctrl+P` or `:` to open
2. Start typing to filter commands
3. Use arrow keys to select
4. Press `Enter` to execute
5. Recent commands appear at the bottom

## Keyboard Reference

### Navigation
| Key | Action |
|-----|--------|
| `j` | Move down |
| `k` | Move up |
| `gg` | First conversation |
| `G` | Last conversation |
| `u` | Next unread |
| `Enter` | Open conversation |
| `Ctrl+d` | Page down |
| `Ctrl+u` | Page up |

### Actions
| Key | Action |
|-----|--------|
| `e` | Archive |
| `m` | Mute/unmute |
| `/` | Search |
| `n` | Toggle note |
| `N` | Edit note |

### Quick Jump
| Key | Action |
|-----|--------|
| `Alt+1-9` | Jump to conversation 1-9 |

### Command Palette
| Key | Action |
|-----|--------|
| `Ctrl+P` | Open palette |
| `:` | Open palette (alt) |
| `Esc` | Close palette |
| `↑` / `↓` | Navigate commands |
| `Enter` | Execute command |

### Terminal Mode
| Key | Action |
|-----|--------|
| `Ctrl+Shift+T` | Toggle terminal mode |

## Architecture

### Redux State Management

Terminal mode state is managed through Redux:

```typescript
// State structure
{
  terminal: {
    // Notes
    conversationNotes: Record<conversationId, Note>,
    activeNoteConversationId: string | null,

    // Keybindings
    keybindings: KeyBinding[],
    keybindingMode: 'default' | 'vim' | 'custom',

    // UI Settings
    terminalMode: boolean,
    compactView: boolean,
    monospaceFonts: boolean,

    // Command Palette
    commandPaletteOpen: boolean,
    commandHistory: string[]
  }
}
```

### Components

**Terminal Components**:
- `CommandPalette.tsx` - Command palette overlay
- `ConversationNote.tsx` - Note display component
- `ConversationNoteField.tsx` - Note input field
- `KeybindingSettings.tsx` - Keybinding configuration UI

**Hooks**:
- `useTerminalKeyboard.tsx` - Vim-style keyboard navigation
- `useQuickJump.tsx` - Alt+Number quick jump

**Styling**:
- `TerminalTheme.scss` - Dark terminal theme
- `KeybindingSettings.scss` - Settings UI styles

### Data Persistence

- **Notes**: Stored in `window.storage` under `terminal-notes`
- **Keybindings**: Stored under `terminal-keybindings`
- **Settings**: Individual storage keys for each setting
- **Command History**: Stored under `terminal-command-history`

## Customization

### Adding Custom Commands

Commands can be defined in the CommandPalette component:

```typescript
const commands: Command[] = [
  {
    id: 'archive',
    name: 'Archive Conversation',
    description: 'Move conversation to archive',
    shortcut: 'e',
    execute: () => archiveConversation()
  }
  // Add more commands...
];
```

### Custom Themes

Terminal theme colors can be customized in `TerminalTheme.scss`:

```scss
:root {
  --terminal-bg-primary: #0a0e14;
  --terminal-text-primary: #c9d1d9;
  --terminal-accent-blue: #58a6ff;
  // Customize more colors...
}
```

### Custom Keybindings

Add new keybindings in `terminal.ts`:

```typescript
const customBinding: KeyBinding = {
  id: 'my-action',
  action: 'MY_CUSTOM_ACTION',
  key: 'x',
  modifiers: ['ctrl'],
  description: 'My custom action'
};
```

## Tips & Tricks

1. **Muscle Memory**: Start with Vim mode and practice the basic navigation (`j`, `k`, `gg`, `G`)
2. **Notes for Context**: Use notes to tag conversations (e.g., "work", "urgent", "follow-up")
3. **Command Palette**: When you forget a shortcut, use `Ctrl+P` to search
4. **Quick Jump**: Use `Alt+1-9` for your most important conversations
5. **Compact View**: Enable for maximum information density
6. **Keyboard Focus**: The terminal mode works best when focus is on the conversation list

## Troubleshooting

**Keybindings not working?**
- Check that terminal mode is enabled
- Ensure you're not focused in a text input field
- Try resetting keybindings to defaults

**Notes not saving?**
- Check browser storage permissions
- Verify `window.storage` is available
- Look for errors in the developer console

**Theme not applying?**
- Ensure terminal mode is enabled in settings
- Check that the CSS is properly loaded
- Verify `terminal-mode` class is on the body element

## Development

### File Structure
```
ts/
├── components/terminal/
│   ├── CommandPalette.tsx
│   ├── ConversationNote.tsx
│   ├── ConversationNoteField.tsx
│   └── KeybindingSettings.tsx
├── hooks/
│   └── useTerminalKeyboard.tsx
├── state/ducks/
│   └── terminal.ts

stylesheets/components/terminal/
├── TerminalTheme.scss
└── KeybindingSettings.scss
```

### Testing

To test terminal mode features:

1. Enable terminal mode in settings
2. Open the developer console
3. Check Redux state: `window.reduxStore.getState().terminal`
4. Test keybindings in the conversation list
5. Verify notes are persisted: `window.storage.get('terminal-notes')`

## Future Enhancements

- [ ] Search conversations by note content
- [ ] Multi-line notes with markdown support
- [ ] Note templates
- [ ] Keybinding profiles (import/export)
- [ ] Macro recording
- [ ] Quick filters (unread, mentions, groups)
- [ ] Conversation tagging system
- [ ] Custom command scripts
- [ ] Tmux-style pane management

## Contributing

Contributions are welcome! Areas for improvement:

- Additional vim-style commands
- More command palette actions
- Enhanced note features
- Performance optimizations
- Accessibility improvements
- Documentation and examples

## Credits

Inspired by:
- Bloomberg Terminal - Professional trading interface
- Vim - Efficient keyboard navigation
- Signal Desktop - Private messaging

Built for power users who value keyboard efficiency and clean interfaces.
