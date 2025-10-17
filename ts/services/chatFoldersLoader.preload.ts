// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { DataReader } from '../sql/Client.preload.js';
import type { CurrentChatFolder } from '../types/CurrentChatFolders.std.js';
import { strictAssert } from '../util/assert.std.js';

let chatFolders: ReadonlyArray<CurrentChatFolder>;

export async function loadChatFolders(): Promise<void> {
  chatFolders = await DataReader.getCurrentChatFolders();
}

export function getChatFoldersForRedux(): ReadonlyArray<CurrentChatFolder> {
  strictAssert(chatFolders != null, 'chatFolders has not been loaded');
  return chatFolders;
}
