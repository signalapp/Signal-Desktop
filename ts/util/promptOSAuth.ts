// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer } from 'electron';
import type {
  PromptOSAuthReasonType,
  PromptOSAuthResultType,
} from './os/promptOSAuthMain.main.js';

export async function promptOSAuth(
  reason: PromptOSAuthReasonType
): Promise<PromptOSAuthResultType> {
  return new Promise<PromptOSAuthResultType>((resolve, _reject) => {
    let localeString: string | undefined;

    // TODO: DESKTOP-8895
    if (window.Signal.OS.isMacOS()) {
      if (reason === 'enable-backups') {
        localeString = 'enable backups';
      } else if (reason === 'view-aep') {
        localeString = 'show your backup key';
      }
    }

    if (window.Signal.OS.isWindows()) {
      if (reason === 'enable-backups') {
        localeString = 'Verify your identity to enable backups.';
      } else if (reason === 'view-aep') {
        localeString = 'Verify your identity to view your backup key.';
      }
    }

    ipcRenderer.once(`prompt-os-auth:${reason}`, (_, response) => {
      resolve(response ?? 'error');
    });
    ipcRenderer.send('prompt-os-auth', { reason, localeString });
  });
}
