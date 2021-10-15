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
