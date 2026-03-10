// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as RemoteConfig from '../RemoteConfig.dom.js';
import { parseIntWithFallback } from './parseIntWithFallback.std.js';

export function getPinnedMessagesLimit(): number {
  const remoteValue = RemoteConfig.getValue('global.pinned_message_limit');
  return parseIntWithFallback(remoteValue, 3);
}
