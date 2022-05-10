// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useEffect } from 'react';
import { get } from 'lodash';

import * as KeyboardLayout from '../services/keyboardLayout';

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

export function useActiveCallShortcuts(
  hangUp: () => unknown
): KeyboardShortcutHandlerType {
  return useCallback(
    ev => {
      const { shiftKey } = ev;
      const key = KeyboardLayout.lookup(ev);

      if (isCtrlOrAlt(ev) && shiftKey && (key === 'e' || key === 'E')) {
        ev.preventDefault();
        ev.stopPropagation();

        hangUp();
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
  return useCallback(
    ev => {
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
    [startAudioRecording]
  );
}

export function useAttachFileShortcut(
  attachFile: () => unknown
): KeyboardShortcutHandlerType {
  return useCallback(
    ev => {
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
    [attachFile]
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
