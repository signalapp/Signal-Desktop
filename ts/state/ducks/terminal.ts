// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ThunkAction } from 'redux-thunk';
import type { ReadonlyDeep } from 'type-fest';
import type { StateType as RootStateType } from '../reducer.js';
import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions.js';
import { useBoundActions } from '../../hooks/useBoundActions.js';

// State

export type ConversationNote = ReadonlyDeep<{
  conversationId: string;
  note: string;
  lastModified: number;
}>;

export type KeyBinding = ReadonlyDeep<{
  id: string;
  action: string;
  key: string;
  modifiers: ReadonlyArray<'ctrl' | 'alt' | 'shift' | 'meta'>;
  description: string;
}>;

export type TerminalStateType = ReadonlyDeep<{
  // Notes
  conversationNotes: Record<string, ConversationNote>;
  activeNoteConversationId: string | null;

  // Keybindings
  keybindings: ReadonlyArray<KeyBinding>;
  keybindingMode: 'default' | 'superhuman' | 'custom';

  // Command palette
  commandPaletteOpen: boolean;
  commandHistory: ReadonlyArray<string>;

  // Terminal UI settings
  terminalMode: boolean;
  compactView: boolean;
  monospaceFonts: boolean;
}>;

// Actions

const SET_CONVERSATION_NOTE = 'terminal/SET_CONVERSATION_NOTE';
const DELETE_CONVERSATION_NOTE = 'terminal/DELETE_CONVERSATION_NOTE';
const SET_ACTIVE_NOTE = 'terminal/SET_ACTIVE_NOTE';
const CLEAR_ACTIVE_NOTE = 'terminal/CLEAR_ACTIVE_NOTE';

const SET_KEYBINDING = 'terminal/SET_KEYBINDING';
const DELETE_KEYBINDING = 'terminal/DELETE_KEYBINDING';
const SET_KEYBINDING_MODE = 'terminal/SET_KEYBINDING_MODE';
const RESET_KEYBINDINGS = 'terminal/RESET_KEYBINDINGS';

const TOGGLE_COMMAND_PALETTE = 'terminal/TOGGLE_COMMAND_PALETTE';
const ADD_COMMAND_HISTORY = 'terminal/ADD_COMMAND_HISTORY';
const CLEAR_COMMAND_HISTORY = 'terminal/CLEAR_COMMAND_HISTORY';

const TOGGLE_TERMINAL_MODE = 'terminal/TOGGLE_TERMINAL_MODE';
const SET_COMPACT_VIEW = 'terminal/SET_COMPACT_VIEW';
const SET_MONOSPACE_FONTS = 'terminal/SET_MONOSPACE_FONTS';

// Action Types

type SetConversationNoteActionType = ReadonlyDeep<{
  type: typeof SET_CONVERSATION_NOTE;
  payload: {
    conversationId: string;
    note: string;
  };
}>;

type DeleteConversationNoteActionType = ReadonlyDeep<{
  type: typeof DELETE_CONVERSATION_NOTE;
  payload: {
    conversationId: string;
  };
}>;

type SetActiveNoteActionType = ReadonlyDeep<{
  type: typeof SET_ACTIVE_NOTE;
  payload: {
    conversationId: string;
  };
}>;

type ClearActiveNoteActionType = ReadonlyDeep<{
  type: typeof CLEAR_ACTIVE_NOTE;
}>;

type SetKeybindingActionType = ReadonlyDeep<{
  type: typeof SET_KEYBINDING;
  payload: KeyBinding;
}>;

type DeleteKeybindingActionType = ReadonlyDeep<{
  type: typeof DELETE_KEYBINDING;
  payload: {
    id: string;
  };
}>;

type SetKeybindingModeActionType = ReadonlyDeep<{
  type: typeof SET_KEYBINDING_MODE;
  payload: {
    mode: 'default' | 'superhuman' | 'custom';
  };
}>;

type ResetKeybindingsActionType = ReadonlyDeep<{
  type: typeof RESET_KEYBINDINGS;
}>;

type ToggleCommandPaletteActionType = ReadonlyDeep<{
  type: typeof TOGGLE_COMMAND_PALETTE;
}>;

type AddCommandHistoryActionType = ReadonlyDeep<{
  type: typeof ADD_COMMAND_HISTORY;
  payload: {
    command: string;
  };
}>;

type ClearCommandHistoryActionType = ReadonlyDeep<{
  type: typeof CLEAR_COMMAND_HISTORY;
}>;

type ToggleTerminalModeActionType = ReadonlyDeep<{
  type: typeof TOGGLE_TERMINAL_MODE;
}>;

type SetCompactViewActionType = ReadonlyDeep<{
  type: typeof SET_COMPACT_VIEW;
  payload: {
    enabled: boolean;
  };
}>;

type SetMonospaceFontsActionType = ReadonlyDeep<{
  type: typeof SET_MONOSPACE_FONTS;
  payload: {
    enabled: boolean;
  };
}>;

export type TerminalActionType = ReadonlyDeep<
  | SetConversationNoteActionType
  | DeleteConversationNoteActionType
  | SetActiveNoteActionType
  | ClearActiveNoteActionType
  | SetKeybindingActionType
  | DeleteKeybindingActionType
  | SetKeybindingModeActionType
  | ResetKeybindingsActionType
  | ToggleCommandPaletteActionType
  | AddCommandHistoryActionType
  | ClearCommandHistoryActionType
  | ToggleTerminalModeActionType
  | SetCompactViewActionType
  | SetMonospaceFontsActionType
>;

// Action Creators

export const actions = {
  setConversationNote,
  deleteConversationNote,
  setActiveNote,
  clearActiveNote,
  setKeybinding,
  deleteKeybinding,
  setKeybindingMode,
  resetKeybindings,
  toggleCommandPalette,
  addCommandHistory,
  clearCommandHistory,
  toggleTerminalMode,
  setCompactView,
  setMonospaceFonts,
};

export const useTerminalActions = (): BoundActionCreatorsMapObject<
  typeof actions
> => useBoundActions(actions);

function setConversationNote(
  conversationId: string,
  note: string
): ThunkAction<void, RootStateType, unknown, SetConversationNoteActionType> {
  return async (dispatch, getState) => {
    dispatch({
      type: SET_CONVERSATION_NOTE,
      payload: {
        conversationId,
        note,
      },
    });

    // Persist to storage
    const state = getState();
    await window.storage.put('terminal-notes', state.terminal.conversationNotes);
  };
}

function deleteConversationNote(
  conversationId: string
): ThunkAction<void, RootStateType, unknown, DeleteConversationNoteActionType> {
  return async (dispatch, getState) => {
    dispatch({
      type: DELETE_CONVERSATION_NOTE,
      payload: {
        conversationId,
      },
    });

    // Persist to storage
    const state = getState();
    await window.storage.put('terminal-notes', state.terminal.conversationNotes);
  };
}

function setActiveNote(conversationId: string): SetActiveNoteActionType {
  return {
    type: SET_ACTIVE_NOTE,
    payload: {
      conversationId,
    },
  };
}

function clearActiveNote(): ClearActiveNoteActionType {
  return {
    type: CLEAR_ACTIVE_NOTE,
  };
}

function setKeybinding(keybinding: KeyBinding): ThunkAction<void, RootStateType, unknown, SetKeybindingActionType> {
  return async (dispatch, getState) => {
    dispatch({
      type: SET_KEYBINDING,
      payload: keybinding,
    });

    // Persist to storage
    const state = getState();
    await window.storage.put('terminal-keybindings', state.terminal.keybindings);
  };
}

function deleteKeybinding(id: string): ThunkAction<void, RootStateType, unknown, DeleteKeybindingActionType> {
  return async (dispatch, getState) => {
    dispatch({
      type: DELETE_KEYBINDING,
      payload: { id },
    });

    // Persist to storage
    const state = getState();
    await window.storage.put('terminal-keybindings', state.terminal.keybindings);
  };
}

function setKeybindingMode(mode: 'default' | 'superhuman' | 'custom'): ThunkAction<void, RootStateType, unknown, SetKeybindingModeActionType> {
  return async (dispatch, getState) => {
    dispatch({
      type: SET_KEYBINDING_MODE,
      payload: { mode },
    });

    // Persist to storage
    const state = getState();
    await window.storage.put('terminal-keybinding-mode', mode);
  };
}

function resetKeybindings(): ThunkAction<void, RootStateType, unknown, ResetKeybindingsActionType> {
  return async dispatch => {
    dispatch({
      type: RESET_KEYBINDINGS,
    });

    // Clear from storage
    await window.storage.remove('terminal-keybindings');
  };
}

function toggleCommandPalette(): ToggleCommandPaletteActionType {
  return {
    type: TOGGLE_COMMAND_PALETTE,
  };
}

function addCommandHistory(command: string): ThunkAction<void, RootStateType, unknown, AddCommandHistoryActionType> {
  return async (dispatch, getState) => {
    dispatch({
      type: ADD_COMMAND_HISTORY,
      payload: { command },
    });

    // Persist to storage
    const state = getState();
    await window.storage.put('terminal-command-history', state.terminal.commandHistory);
  };
}

function clearCommandHistory(): ThunkAction<void, RootStateType, unknown, ClearCommandHistoryActionType> {
  return async dispatch => {
    dispatch({
      type: CLEAR_COMMAND_HISTORY,
    });

    await window.storage.remove('terminal-command-history');
  };
}

function toggleTerminalMode(): ThunkAction<void, RootStateType, unknown, ToggleTerminalModeActionType> {
  return async (dispatch, getState) => {
    dispatch({
      type: TOGGLE_TERMINAL_MODE,
    });

    const state = getState();
    await window.storage.put('terminal-mode', state.terminal.terminalMode);
  };
}

function setCompactView(enabled: boolean): ThunkAction<void, RootStateType, unknown, SetCompactViewActionType> {
  return async dispatch => {
    dispatch({
      type: SET_COMPACT_VIEW,
      payload: { enabled },
    });

    await window.storage.put('terminal-compact-view', enabled);
  };
}

function setMonospaceFonts(enabled: boolean): ThunkAction<void, RootStateType, unknown, SetMonospaceFontsActionType> {
  return async dispatch => {
    dispatch({
      type: SET_MONOSPACE_FONTS,
      payload: { enabled },
    });

    await window.storage.put('terminal-monospace-fonts', enabled);
  };
}

// Default Keybindings - Basic shortcuts

function getDefaultKeybindings(): ReadonlyArray<KeyBinding> {
  return [
    // Navigation
    { id: 'nav-up', action: 'NAVIGATE_UP', key: 'ArrowUp', modifiers: [], description: 'Navigate up' },
    { id: 'nav-down', action: 'NAVIGATE_DOWN', key: 'ArrowDown', modifiers: [], description: 'Navigate down' },
    { id: 'open-conversation', action: 'OPEN_CONVERSATION', key: 'Enter', modifiers: [], description: 'Open conversation' },
    { id: 'close', action: 'CLOSE', key: 'Escape', modifiers: [], description: 'Close/Go back' },

    // Actions
    { id: 'archive', action: 'ARCHIVE', key: 'e', modifiers: [], description: 'Archive conversation' },
    { id: 'mute', action: 'MUTE', key: 'm', modifiers: [], description: 'Mute conversation' },
    { id: 'search', action: 'SEARCH', key: 'f', modifiers: ['ctrl'], description: 'Search' },

    // Notes
    { id: 'toggle-note', action: 'TOGGLE_NOTE', key: 'n', modifiers: [], description: 'Add note' },

    // Command palette
    { id: 'command-palette', action: 'COMMAND_PALETTE', key: 'k', modifiers: ['ctrl'], description: 'Command palette' },
  ];
}

// Superhuman-style Keybindings - Email-inspired efficiency

function getSuperhumanKeybindings(): ReadonlyArray<KeyBinding> {
  return [
    // Navigation (j/k like Superhuman)
    { id: 'nav-down', action: 'NAVIGATE_DOWN', key: 'j', modifiers: [], description: 'Next conversation' },
    { id: 'nav-up', action: 'NAVIGATE_UP', key: 'k', modifiers: [], description: 'Previous conversation' },
    { id: 'nav-first', action: 'NAVIGATE_FIRST', key: 'g', modifiers: [], description: 'First conversation (press gg)' },
    { id: 'nav-last', action: 'NAVIGATE_LAST', key: 'G', modifiers: ['shift'], description: 'Last conversation' },
    { id: 'next-unread', action: 'NEXT_UNREAD', key: 'u', modifiers: [], description: 'Next unread' },

    // Core Actions (Superhuman mnemonic style)
    { id: 'open', action: 'OPEN_CONVERSATION', key: 'Enter', modifiers: [], description: 'Open conversation' },
    { id: 'done', action: 'ARCHIVE', key: 'e', modifiers: [], description: 'Done (Archive)' },
    { id: 'star', action: 'PIN', key: 's', modifiers: [], description: 'Star/Pin conversation' },
    { id: 'mute', action: 'MUTE', key: 'm', modifiers: [], description: 'Mute conversation' },
    { id: 'delete', action: 'DELETE', key: '#', modifiers: ['shift'], description: 'Delete conversation' },
    { id: 'spam', action: 'SPAM', key: '!', modifiers: ['shift'], description: 'Report spam' },

    // Reply actions
    { id: 'reply', action: 'REPLY', key: 'r', modifiers: [], description: 'Reply' },
    { id: 'forward', action: 'FORWARD', key: 'f', modifiers: [], description: 'Forward' },

    // Search and Command
    { id: 'search', action: 'SEARCH', key: '/', modifiers: [], description: 'Search' },
    { id: 'command-palette', action: 'COMMAND_PALETTE', key: 'k', modifiers: ['ctrl'], description: 'Command palette (Cmd+K)' },
    { id: 'command-palette-meta', action: 'COMMAND_PALETTE', key: 'k', modifiers: ['meta'], description: 'Command palette (Cmd+K on Mac)' },

    // Notes
    { id: 'note', action: 'TOGGLE_NOTE', key: 'n', modifiers: [], description: 'Add/edit note' },

    // Close/Escape
    { id: 'close', action: 'CLOSE', key: 'Escape', modifiers: [], description: 'Close/Back' },

    // Quick navigation
    { id: 'page-down', action: 'PAGE_DOWN', key: 'j', modifiers: ['ctrl'], description: 'Page down' },
    { id: 'page-up', action: 'PAGE_UP', key: 'k', modifiers: ['ctrl'], description: 'Page up' },

    // Shortcuts helper
    { id: 'shortcuts', action: 'SHOW_SHORTCUTS', key: '?', modifiers: ['shift'], description: 'Show keyboard shortcuts' },
  ];
}

// Reducer

export function getEmptyState(): TerminalStateType {
  return {
    conversationNotes: {},
    activeNoteConversationId: null,
    keybindings: getSuperhumanKeybindings(),
    keybindingMode: 'superhuman',
    commandPaletteOpen: false,
    commandHistory: [],
    terminalMode: true,
    compactView: true,
    monospaceFonts: true,
  };
}

export function reducer(
  state: Readonly<TerminalStateType> = getEmptyState(),
  action: Readonly<TerminalActionType>
): TerminalStateType {
  if (action.type === SET_CONVERSATION_NOTE) {
    const { conversationId, note } = action.payload;
    return {
      ...state,
      conversationNotes: {
        ...state.conversationNotes,
        [conversationId]: {
          conversationId,
          note,
          lastModified: Date.now(),
        },
      },
    };
  }

  if (action.type === DELETE_CONVERSATION_NOTE) {
    const { conversationId } = action.payload;
    const { [conversationId]: _removed, ...remainingNotes } = state.conversationNotes;
    return {
      ...state,
      conversationNotes: remainingNotes,
    };
  }

  if (action.type === SET_ACTIVE_NOTE) {
    return {
      ...state,
      activeNoteConversationId: action.payload.conversationId,
    };
  }

  if (action.type === CLEAR_ACTIVE_NOTE) {
    return {
      ...state,
      activeNoteConversationId: null,
    };
  }

  if (action.type === SET_KEYBINDING) {
    const existingIndex = state.keybindings.findIndex(
      kb => kb.id === action.payload.id
    );

    if (existingIndex >= 0) {
      const newKeybindings = [...state.keybindings];
      newKeybindings[existingIndex] = action.payload;
      return {
        ...state,
        keybindings: newKeybindings,
      };
    }

    return {
      ...state,
      keybindings: [...state.keybindings, action.payload],
    };
  }

  if (action.type === DELETE_KEYBINDING) {
    return {
      ...state,
      keybindings: state.keybindings.filter(kb => kb.id !== action.payload.id),
    };
  }

  if (action.type === SET_KEYBINDING_MODE) {
    const { mode } = action.payload;
    let newKeybindings = state.keybindings;

    if (mode === 'superhuman') {
      newKeybindings = getSuperhumanKeybindings();
    } else if (mode === 'default') {
      newKeybindings = getDefaultKeybindings();
    }

    return {
      ...state,
      keybindingMode: mode,
      keybindings: newKeybindings,
    };
  }

  if (action.type === RESET_KEYBINDINGS) {
    return {
      ...state,
      keybindings: state.keybindingMode === 'superhuman'
        ? getSuperhumanKeybindings()
        : getDefaultKeybindings(),
    };
  }

  if (action.type === TOGGLE_COMMAND_PALETTE) {
    return {
      ...state,
      commandPaletteOpen: !state.commandPaletteOpen,
    };
  }

  if (action.type === ADD_COMMAND_HISTORY) {
    const { command } = action.payload;
    const history = [command, ...state.commandHistory.filter(c => c !== command)];
    return {
      ...state,
      commandHistory: history.slice(0, 50), // Keep last 50 commands
    };
  }

  if (action.type === CLEAR_COMMAND_HISTORY) {
    return {
      ...state,
      commandHistory: [],
    };
  }

  if (action.type === TOGGLE_TERMINAL_MODE) {
    return {
      ...state,
      terminalMode: !state.terminalMode,
    };
  }

  if (action.type === SET_COMPACT_VIEW) {
    return {
      ...state,
      compactView: action.payload.enabled,
    };
  }

  if (action.type === SET_MONOSPACE_FONTS) {
    return {
      ...state,
      monospaceFonts: action.payload.enabled,
    };
  }

  return state;
}
