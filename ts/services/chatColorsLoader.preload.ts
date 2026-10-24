// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { DataReader } from '../sql/Client.preload.ts';
import type { ChatStyle } from '../types/ChatStyle.std.ts';
import { strictAssert } from '../util/assert.std.ts';

let customChatColors: ReadonlyArray<ChatStyle.CustomChatColor> | undefined;

export async function loadChatColors(): Promise<void> {
  customChatColors = await DataReader.getAllCustomChatColors();
}

export function getCustomChatColorsForRedux(): ReadonlyArray<ChatStyle.CustomChatColor> {
  strictAssert(customChatColors != null, 'chatColors has not been loaded');
  return customChatColors;
}
