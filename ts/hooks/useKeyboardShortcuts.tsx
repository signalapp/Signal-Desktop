// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useEffect } from 'react';
import { get } from 'lodash';
import { useSelector } from 'react-redux';
import * as KeyboardLayout from '../services/keyboardLayout';
import { getHasPanelOpen } from '../state/selectors/conversations';
import { isInFullScreenCall } from '../state/selectors/calling';
import { isShowingAnyModal } from '../state/selectors/globalModals';
import type { ContextMenuTriggerType } from '../components/conversation/MessageContextMenu';

type KeyboardShortcutHandlerType = (ev: KeyboardEvent) => boolean;

export function isCmdOrCtrl(ev: KeyboardEvent): boolean {
  const { ctrlKey, metaKey } = ev;
  const commandKey = get(window, 'platform') === 'darwin' && metaKey;
  const controlKey = get(window, 'platform') !== 'darwin' && ctrlKey;
  return commandKey || controlKey;
}

function isCtrlOrAlt(ev: KeyboardEvent): boolean {
  const { altKey, ctrlKey } = ev;
  const controlKey = get(window, 'platform') === 'darwin' && ctrlKey;
  const theAltKey = get(window, 'platform') !== 'darwin' && altKey;
  return controlKey || theAltKey;
}

type Mods = {
  // Mac: Meta (Command), Windows: Control
  controlOrMeta: boolean;
  // Shift
  shift: boolean;
  // Mac: Option, Windows: Alt
  alt: boolean;
};

const defaultsMods: Mods = {
  controlOrMeta: false,
  shift: false,
  alt: false,
};

/**
 * Checks if a keyboard event has the exact modifiers specified in the options,
 * and no others currently pressed.
 */
function hasExactModifiers(
  event: KeyboardEvent,
  options: Mods | 'none'
): boolean {
  const mods = options === 'none' ? defaultsMods : options;
  const isApple = get(window, 'platform') === 'darwin';

  if (isApple) {
    if (event.metaKey !== mods.controlOrMeta) {
      return false;
    }
    if (event.ctrlKey) {
      return false;
    }
  } else {
    if (event.ctrlKey !== mods.controlOrMeta) {
      return false;
    }
    if (event.metaKey) {
      return false;
    }
  }

  if (event.shiftKey !== mods.shift) {
    return false;
  }

  if (event.altKey !== mods.alt) {
    return false;
  }

  return true;
}

function useHasPanels(): boolean {
  return useSelector(getHasPanelOpen);
}

function useHasGlobalModal(): boolean {
  return useSelector(isShowingAnyModal);
}

function useHasCalling(): boolean {
  return useSelector(isInFullScreenCall);
}

function useHasAnyOverlay(): boolean {
  const panels = useHasPanels();
  const globalModal = useHasGlobalModal();
  const calling = useHasCalling();

  return panels || globalModal || calling;
}

export function isKeyboardActivation(event: KeyboardEvent): boolean {
  if (
    hasExactModifiers(event, 'none') &&
    (event.key === 'Enter' || event.key === 'Space')
  ) {
    return true;
  }

  return false;
}

export function useActiveCallShortcuts(
  hangUp: (reason: string) => unknown
): KeyboardShortcutHandlerType {
  return useCallback(
    ev => {
      const { shiftKey } = ev;
      const key = KeyboardLayout.lookup(ev);

      if (isCtrlOrAlt(ev) && shiftKey && (key === 'e' || key === 'E')) {
        ev.preventDefault();
        ev.stopPropagation();

        hangUp('Keyboard shortcut');
        return true;
      }

      return false;
    },
    [hangUp]
  );
}

export function useIncomingCallShortcuts(
  acceptAudioCall: () => unknown,
  acceptVideoCall: () => unknown,
  declineCall: () => unknown
): KeyboardShortcutHandlerType {
  return useCallback(
    ev => {
      const { shiftKey } = ev;
      const key = KeyboardLayout.lookup(ev);

      if (isCtrlOrAlt(ev) && shiftKey && (key === 'v' || key === 'V')) {
        ev.preventDefault();
        ev.stopPropagation();

        acceptVideoCall();
        return true;
      }

      if (isCtrlOrAlt(ev) && shiftKey && (key === 'a' || key === 'A')) {
        ev.preventDefault();
        ev.stopPropagation();

        acceptAudioCall();
        return true;
      }

      if (isCtrlOrAlt(ev) && shiftKey && (key === 'd' || key === 'D')) {
        ev.preventDefault();
        ev.stopPropagation();

        declineCall();
        return true;
      }

      return false;
    },
    [acceptAudioCall, acceptVideoCall, declineCall]
  );
}

export function useStartCallShortcuts(
  startAudioCall: () => unknown,
  startVideoCall: () => unknown
): KeyboardShortcutHandlerType {
  return useCallback(
    ev => {
      const { shiftKey } = ev;
      const key = KeyboardLayout.lookup(ev);

      if (isCtrlOrAlt(ev) && shiftKey && (key === 'c' || key === 'C')) {
        ev.preventDefault();
        ev.stopPropagation();

        startAudioCall();
        return true;
      }

      if (isCtrlOrAlt(ev) && shiftKey && (key === 'y' || key === 'Y')) {
        ev.preventDefault();
        ev.stopPropagation();

        startVideoCall();
        return true;
      }

      return false;
    },
    [startAudioCall, startVideoCall]
  );
}

export function useStartRecordingShortcut(
  startAudioRecording: () => unknown
): KeyboardShortcutHandlerType {
  const hasOverlay = useHasAnyOverlay();

  return useCallback(
    ev => {
      if (hasOverlay) {
        return false;
      }

      const key = KeyboardLayout.lookup(ev);

      if (
        hasExactModifiers(ev, {
          controlOrMeta: true,
          shift: true,
          alt: false,
        }) &&
        (key === 'y' || key === 'Y')
      ) {
        ev.preventDefault();
        ev.stopPropagation();

        startAudioRecording();
        return true;
      }

      return false;
    },
    [hasOverlay, startAudioRecording]
  );
}

export function useAttachFileShortcut(
  attachFile: () => unknown
): KeyboardShortcutHandlerType {
  const hasOverlay = useHasAnyOverlay();

  return useCallback(
    ev => {
      if (hasOverlay) {
        return false;
      }

      const { shiftKey } = ev;
      const key = KeyboardLayout.lookup(ev);

      if (isCmdOrCtrl(ev) && !shiftKey && (key === 'u' || key === 'U')) {
        ev.preventDefault();
        ev.stopPropagation();

        attachFile();
        return true;
      }

      return false;
    },
    [attachFile, hasOverlay]
  );
}

export function useToggleReactionPicker(
  handleReact: () => unknown
): KeyboardShortcutHandlerType {
  const hasOverlay = useHasAnyOverlay();

  return useCallback(
    ev => {
      if (hasOverlay) {
        return false;
      }

      const { shiftKey } = ev;
      const key = KeyboardLayout.lookup(ev);

      if (isCmdOrCtrl(ev) && shiftKey && (key === 'e' || key === 'E')) {
        ev.preventDefault();
        ev.stopPropagation();

        handleReact();
        return true;
      }

      return false;
    },
    [handleReact, hasOverlay]
  );
}

export function useOpenContextMenu(
  openContextMenu: ContextMenuTriggerType['handleContextClick'] | undefined
): KeyboardShortcutHandlerType {
  const hasOverlay = useHasAnyOverlay();

  return useCallback(
    ev => {
      if (hasOverlay) {
        return false;
      }

      const { shiftKey } = ev;
      const key = KeyboardLayout.lookup(ev);

      const isMacOS = get(window, 'platform') === 'darwin';

      if (
        (!isMacOS && shiftKey && key === 'F10') ||
        (isMacOS && isCmdOrCtrl(ev) && key === 'F12')
      ) {
        ev.preventDefault();
        ev.stopPropagation();

        openContextMenu?.(new MouseEvent('click'));
        return true;
      }

      return false;
    },
    [hasOverlay, openContextMenu]
  );
}

export function useEditLastMessageSent(
  maybeEditMessage: () => boolean
): KeyboardShortcutHandlerType {
  const hasOverlay = useHasAnyOverlay();

  return useCallback(
    ev => {
      if (hasOverlay) {
        return false;
      }

      const key = KeyboardLayout.lookup(ev);

      // None of the modifiers should be pressed
      if (!hasExactModifiers(ev, 'none')) {
        return false;
      }

      if (key === 'ArrowUp') {
        const value = maybeEditMessage();
        if (value) {
          ev.preventDefault();
          ev.stopPropagation();
        }

        return value;
      }

      return false;
    },
    [hasOverlay, maybeEditMessage]
  );
}

export function useKeyboardShortcuts(
  ...eventHandlers: Array<KeyboardShortcutHandlerType>
): void {
  useEffect(() => {
    function handleKeydown(ev: KeyboardEvent): void {
      eventHandlers.some(eventHandler => eventHandler(ev));
    }

    document.addEventListener('keydown', handleKeydown);
    return () => {
      document.removeEventListener('keydown', handleKeydown);
    };
  }, [eventHandlers]);
}

export function useKeyboardShortcutsConditionally(
  condition: boolean,
  ...eventHandlers: Array<KeyboardShortcutHandlerType>
): void {
  useEffect(() => {
    if (!condition) {
      return;
    }

    function handleKeydown(ev: KeyboardEvent): void {
      eventHandlers.some(eventHandler => eventHandler(ev));
    }

    document.addEventListener('keydown', handleKeydown);
    return () => {
      document.removeEventListener('keydown', handleKeydown);
    };
  }, [condition, eventHandlers]);
}
