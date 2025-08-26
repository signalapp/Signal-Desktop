// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { DataReader } from '../sql/Client';
import type { ChatFolder } from '../types/ChatFolder';
import { strictAssert } from '../util/assert';

let chatFolders: ReadonlyArray<ChatFolder>;

export async function loadChatFolders(): Promise<void> {
  chatFolders = await DataReader.getCurrentChatFolders();
}

export function getChatFoldersForRedux(): ReadonlyArray<ChatFolder> {
  strictAssert(chatFolders != null, 'chatFolders has not been loaded');
  return chatFolders;
}
