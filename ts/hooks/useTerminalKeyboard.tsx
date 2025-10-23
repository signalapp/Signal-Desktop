// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { getConversationSelector } from '../state/selectors/conversations.js';
import { useTerminalActions } from '../state/ducks/terminal.js';
import type { StateType } from '../state/reducer.js';
import type { KeyBinding } from '../state/ducks/terminal.js';

type KeyboardAction =
  | 'NAVIGATE_UP'
  | 'NAVIGATE_DOWN'
  | 'NAVIGATE_FIRST'
  | 'NAVIGATE_LAST'
  | 'NEXT_UNREAD'
  | 'OPEN_CONVERSATION'
  | 'ARCHIVE'
  | 'MUTE'
  | 'SEARCH'
  | 'TOGGLE_NOTE'
  | 'EDIT_NOTE'
  | 'COMMAND_PALETTE'
  | 'TOGGLE_TERMINAL'
  | 'PAGE_DOWN'
  | 'PAGE_UP'
  | 'CLOSE'
  | 'SAVE';

export type TerminalKeyboardHandlers = {
  onNavigateUp?: () => void;
  onNavigateDown?: () => void;
  onNavigateFirst?: () => void;
  onNavigateLast?: () => void;
  onNextUnread?: () => void;
  onOpenConversation?: () => void;
  onArchive?: () => void;
  onMute?: () => void;
  onSearch?: () => void;
  onToggleNote?: () => void;
  onEditNote?: () => void;
  onCommandPalette?: () => void;
  onPageDown?: () => void;
  onPageUp?: () => void;
  onClose?: () => void;
  onSave?: () => void;
};

function matchesKeybinding(event: KeyboardEvent, binding: KeyBinding): boolean {
  // Normalize the key
  const eventKey = event.key.toLowerCase();
  const bindingKey = binding.key.toLowerCase();

  // Check if keys match
  if (eventKey !== bindingKey) {
    return false;
  }

  // Check modifiers
  const hasCtrl = binding.modifiers.includes('ctrl');
  const hasAlt = binding.modifiers.includes('alt');
  const hasShift = binding.modifiers.includes('shift');
  const hasMeta = binding.modifiers.includes('meta');

  if (event.ctrlKey !== hasCtrl) return false;
  if (event.altKey !== hasAlt) return false;
  if (event.shiftKey !== hasShift) return false;
  if (event.metaKey !== hasMeta) return false;

  return true;
}

function isInputElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  const isEditable = target.isContentEditable;

  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    isEditable
  );
}

export function useTerminalKeyboard(
  handlers: TerminalKeyboardHandlers,
  enabled = true
): void {
  const keybindings = useSelector(
    (state: StateType) => state.terminal.keybindings
  );
  const terminalMode = useSelector(
    (state: StateType) => state.terminal.terminalMode
  );
  const appView = useSelector(
    (state: StateType) => state.app.appView
  );
  const { toggleCommandPalette } = useTerminalActions();

  // Only enable terminal keyboard in Inbox view, not during installer/linking
  const isInboxView = appView === 'Inbox';

  // Track sequence for multi-key bindings (like 'gg' for first)
  const keySequence = useRef<string[]>([]);
  const sequenceTimeout = useRef<NodeJS.Timeout | null>(null);

  const resetSequence = useCallback(() => {
    keySequence.current = [];
    if (sequenceTimeout.current) {
      clearTimeout(sequenceTimeout.current);
      sequenceTimeout.current = null;
    }
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Only enable keyboard shortcuts in Inbox view with terminal mode enabled
      if (!enabled || !terminalMode || !isInboxView) {
        return;
      }

      // Don't intercept keys when user is typing in an input
      if (isInputElement(event.target)) {
        resetSequence();
        return;
      }

      // Find matching keybinding
      const matchingBinding = keybindings.find(binding =>
        matchesKeybinding(event, binding)
      );

      if (!matchingBinding) {
        return;
      }

      const { action } = matchingBinding;

      // Handle multi-key sequences (like 'gg')
      if (action === 'NAVIGATE_FIRST') {
        keySequence.current.push('g');

        if (keySequence.current.length === 2) {
          // 'gg' detected
          event.preventDefault();
          event.stopPropagation();
          handlers.onNavigateFirst?.();
          resetSequence();
          return;
        }

        // Set timeout to reset sequence
        if (sequenceTimeout.current) {
          clearTimeout(sequenceTimeout.current);
        }
        sequenceTimeout.current = setTimeout(resetSequence, 500);
        return;
      }

      // Reset sequence for non-sequence keys
      resetSequence();

      // Prevent default behavior for terminal shortcuts
      event.preventDefault();
      event.stopPropagation();

      // Execute action
      switch (action) {
        case 'NAVIGATE_UP':
          handlers.onNavigateUp?.();
          break;
        case 'NAVIGATE_DOWN':
          handlers.onNavigateDown?.();
          break;
        case 'NAVIGATE_LAST':
          handlers.onNavigateLast?.();
          break;
        case 'NEXT_UNREAD':
          handlers.onNextUnread?.();
          break;
        case 'OPEN_CONVERSATION':
          handlers.onOpenConversation?.();
          break;
        case 'ARCHIVE':
          handlers.onArchive?.();
          break;
        case 'MUTE':
          handlers.onMute?.();
          break;
        case 'SEARCH':
          handlers.onSearch?.();
          break;
        case 'TOGGLE_NOTE':
          handlers.onToggleNote?.();
          break;
        case 'EDIT_NOTE':
          handlers.onEditNote?.();
          break;
        case 'COMMAND_PALETTE':
          toggleCommandPalette();
          handlers.onCommandPalette?.();
          break;
        case 'PAGE_DOWN':
          handlers.onPageDown?.();
          break;
        case 'PAGE_UP':
          handlers.onPageUp?.();
          break;
        case 'CLOSE':
          handlers.onClose?.();
          break;
        case 'SAVE':
          handlers.onSave?.();
          break;
        default:
          break;
      }
    },
    [enabled, terminalMode, isInboxView, keybindings, handlers, resetSequence, toggleCommandPalette]
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      resetSequence();
    };
  }, [enabled, handleKeyDown, resetSequence]);
}

// Hook for quick number navigation (1-9 for top conversations)
export function useQuickJump(
  onJumpToIndex: (index: number) => void,
  enabled = true
): void {
  const terminalMode = useSelector(
    (state: StateType) => state.terminal.terminalMode
  );
  const appView = useSelector(
    (state: StateType) => state.app.appView
  );

  useEffect(() => {
    // Only enable in Inbox view
    const isInboxView = appView === 'Inbox';
    if (!enabled || !terminalMode || !isInboxView) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't intercept keys when user is typing
      if (isInputElement(event.target)) {
        return;
      }

      // Check for number keys 1-9 with Alt modifier
      if (event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
        const key = event.key;
        const num = parseInt(key, 10);

        if (!isNaN(num) && num >= 1 && num <= 9) {
          event.preventDefault();
          event.stopPropagation();
          onJumpToIndex(num - 1);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [enabled, terminalMode, appView, onJumpToIndex]);
}
