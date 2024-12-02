// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Session, DesktopCapturerSource, IpcMainEvent } from 'electron';
import { desktopCapturer, ipcMain, systemPreferences } from 'electron';
import { v4 as generateUuid } from 'uuid';

import OS from '../ts/util/os/osMain';
import type { LoggerType } from '../ts/types/Logging';
import { strictAssert } from '../ts/util/assert';
import { type IpcResponseType } from '../ts/util/desktopCapturer';

const SPELL_CHECKER_DICTIONARY_DOWNLOAD_URL = `https://updates.signal.org/desktop/hunspell_dictionaries/${process.versions.electron}/`;

export function updateDefaultSession(
  session: Session,
  getLogger: () => LoggerType
): void {
  session.setSpellCheckerDictionaryDownloadURL(
    SPELL_CHECKER_DICTIONARY_DOWNLOAD_URL
  );

  session.setDisplayMediaRequestHandler(
    async (request, callback) => {
      const { frame, videoRequested, audioRequested } = request;

      try {
        strictAssert(videoRequested, 'Not requesting video');
        strictAssert(!audioRequested, 'Requesting audio');

        // macOS: if screen sharing is actively denied, Sonoma will crash
        // when we try to get the sources.
        if (
          OS.isMacOS() &&
          systemPreferences.getMediaAccessStatus('screen') === 'denied'
        ) {
          callback({});
          return;
        }

        const sources = await desktopCapturer.getSources({
          fetchWindowIcons: true,
          thumbnailSize: { height: 102, width: 184 },
          types: ['screen', 'window'],
        });

        // Wayland already shows a window/screen selection modal so we just
        // have to go with the source that we were given.
        if (OS.isLinux() && OS.isWaylandEnabled() && sources.length === 1) {
          callback({ video: sources[0] });
          return;
        }

        const id = generateUuid();
        ipcMain.once(
          `select-capture-sources:${id}:response`,
          (_event: IpcMainEvent, stream: DesktopCapturerSource | undefined) => {
            try {
              callback({ video: stream });
            } catch {
              // Don't let Electron errors crash the app
            }
          }
        );

        frame?.send('select-capture-sources', {
          id,
          sources,
        } satisfies IpcResponseType);
      } catch (error) {
        try {
          callback({});
        } catch {
          // Electron throws error here, but this is the only way to cancel the
          // request.
        }
        getLogger().error('Failed to get desktopCapturer sources', error);
      }
    },
    { useSystemPicker: false }
  );
}
