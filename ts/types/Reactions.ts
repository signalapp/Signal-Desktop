// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export type ReactionType = Readonly<{
  conversationId: string;
  emoji: string;
  fromId: string;
  messageId: string;
  messageReceivedAt: number;
  targetAuthorUuid: string;
  targetTimestamp: number;
}>;
