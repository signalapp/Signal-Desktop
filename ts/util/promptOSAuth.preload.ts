// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer } from 'electron';
import type {
  PromptOSAuthReasonType,
  PromptOSAuthResultType,
} from './os/promptOSAuthMain.main.js';
import { missingCaseError } from './missingCaseError.std.js';

export async function promptOSAuth(
  reason: PromptOSAuthReasonType
): Promise<PromptOSAuthResultType> {
  return new Promise<PromptOSAuthResultType>((resolve, _reject) => {
    let localeString: string | undefined;

    // TODO: DESKTOP-8895
    if (window.Signal.OS.isMacOS()) {
      if (reason === 'enable-backups') {
        localeString = window.SignalContext.i18n(
          'icu:Preferences__local-backups--enable--os-prompt--mac'
        );
      } else if (reason === 'plaintext-export') {
        localeString = window.SignalContext.i18n(
          'icu:PlaintextExport--OSPrompt--Mac'
        );
      } else if (reason === 'view-aep') {
        localeString = window.SignalContext.i18n(
          'icu:Preferences--local-backups--view-backup-key--os-prompt--mac'
        );
      } else {
        throw missingCaseError(reason);
      }
    }

    if (window.Signal.OS.isWindows()) {
      if (reason === 'enable-backups') {
        localeString = window.SignalContext.i18n(
          'icu:Preferences__local-backups--enable--os-prompt--windows'
        );
      } else if (reason === 'plaintext-export') {
        localeString = window.SignalContext.i18n(
          'icu:PlaintextExport--OSPrompt--Windows'
        );
      } else if (reason === 'view-aep') {
        localeString = window.SignalContext.i18n(
          'icu:Preferences--local-backups--view-backup-key--os-prompt--windows'
        );
      } else {
        throw missingCaseError(reason);
      }
    }

    ipcRenderer.once(`prompt-os-auth:${reason}`, (_, response) => {
      resolve(response ?? 'error');
    });
    ipcRenderer.send('prompt-os-auth', {
      reason,
      localeString,
    });
  });
}
