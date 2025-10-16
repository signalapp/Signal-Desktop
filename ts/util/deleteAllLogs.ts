// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer } from 'electron';
import pTimeout from 'p-timeout';

import { beforeRestart } from '../logging/set_up_renderer_logging.preload.js';
import * as durations from './durations/index.std.js';

export function deleteAllLogs(): Promise<void> {
  // Restart logging again when the file stream close
  beforeRestart();

  return pTimeout(ipcRenderer.invoke('delete-all-logs'), 5 * durations.SECOND);
}
