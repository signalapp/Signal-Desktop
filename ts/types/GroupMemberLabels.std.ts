// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type {
  ConversationType,
  MembershipType,
} from '../state/ducks/conversations.preload.js';
import { SignalService as Proto } from '../protobuf/index.std.js';

export const missingEmojiPlaceholder = '⍰';

export const STRING_BYTE_LIMIT = 96;
export const STRING_GRAPHEME_LIMIT = 24;

export const EMOJI_OUTGOING_BYTE_LIMIT = 48;

export const SERVER_STRING_BYTE_LIMIT = 512;
export const SERVER_EMOJI_BYTE_LIMIT = 64;

export type MemberLabelType = {
  labelString: string;
  labelEmoji: string | undefined;
};

export function getCanAddLabel(
  conversation: ConversationType,
  membership: MembershipType | undefined
): boolean {
  return Boolean(
    membership &&
    conversation.type === 'group' &&
    (membership.isAdmin ||
      conversation.accessControlAttributes ===
        Proto.AccessControl.AccessRequired.MEMBER)
  );
}
