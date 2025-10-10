// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import {
  getPath,
  getDraftPath,
  getStickersPath,
  getTempPath,
} from '../../app/attachments.js';

const userDataPath = window.SignalContext.getPath('userData');

export const ATTACHMENTS_PATH = getPath(userDataPath);
export const DRAFT_PATH = getDraftPath(userDataPath);
export const STICKERS_PATH = getStickersPath(userDataPath);
export const TEMP_PATH = getTempPath(userDataPath);
