// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect } from 'react';
import { get } from 'lodash';

type KeyboardShortcutHandlerType = (ev: KeyboardEvent) => boolean;

function isCmdOrCtrl(ev: KeyboardEvent): boolean {
  const { ctrlKey, metaKey } = ev;
  const commandKey = get(window, 'platform') === 'darwin' && metaKey;
  const controlKey = get(window, 'platform') !== 'darwin' && ctrlKey;
  return commandKey || controlKey;
}

export function getStartRecordingShortcut(
  startAudioRecording: () => unknown
): KeyboardShortcutHandlerType {
  return ev => {
    const { key, shiftKey } = ev;

    if (isCmdOrCtrl(ev) && shiftKey && (key === 'v' || key === 'V')) {
      startAudioRecording();
      ev.preventDefault();
      ev.stopPropagation();

      return true;
    }

    return false;
  };
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
