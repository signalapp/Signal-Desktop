// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer } from 'electron';
import { getActiveWindowService } from '../services/ActiveWindowService.std.js';

const activeWindowService = getActiveWindowService(
  window.document,
  ipcRenderer
);

export { activeWindowService };
