// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useEffect } from 'react';
import { get } from 'lodash';
import { useSelector } from 'react-redux';

import type { PanelRenderType } from '../types/Panels';
import type { StateType } from '../state/reducer';
import * as KeyboardLayout from '../services/keyboardLayout';
import { getTopPanel } from '../state/selectors/conversations';
import { isInFullScreenCall } from '../state/selectors/calling';
import { isShowingAnyModal } from '../state/selectors/globalModals';
import { shouldShowStoriesView } from '../state/selectors/stories';

type KeyboardShortcutHandlerType = (ev: KeyboardEvent) => boolean;

function isCmdOrCtrl(ev: KeyboardEvent): boolean {
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

function useHasPanels(): boolean {
  const topPanel = useSelector<StateType, PanelRenderType | undefined>(
    getTopPanel
  );
  return Boolean(topPanel);
}

function useHasGlobalModal(): boolean {
  return useSelector<StateType, boolean>(isShowingAnyModal);
}

function useHasStories(): boolean {
  return useSelector<StateType, boolean>(shouldShowStoriesView);
}

function useHasCalling(): boolean {
  return useSelector<StateType, boolean>(isInFullScreenCall);
}

function useHasAnyOverlay(): boolean {
  const panels = useHasPanels();
  const globalModal = useHasGlobalModal();
  const stories = useHasStories();
  const calling = useHasCalling();

  return panels || globalModal || stories || calling;
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

      const { shiftKey } = ev;
      const key = KeyboardLayout.lookup(ev);

      if (isCmdOrCtrl(ev) && shiftKey && (key === 'v' || key === 'V')) {
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
