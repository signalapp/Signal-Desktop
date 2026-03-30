// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { parseIntWithFallback } from '../util/parseIntWithFallback.std.ts';
import { getValue } from '../RemoteConfig.dom.ts';
import type { ConversationType } from '../state/ducks/conversations.preload.ts';

const getMaxGroupCallRingSize = (): number =>
  parseIntWithFallback(getValue('global.calling.maxGroupCallRingSize'), 16);

export const isConversationTooBigToRing = (
  conversation: Readonly<Pick<ConversationType, 'memberships'>>
): boolean =>
  (conversation.memberships?.length || 0) >= getMaxGroupCallRingSize();
