// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export const MessageStatuses = [
  'delivered',
  'error',
  'paused',
  'partial-sent',
  'read',
  'sending',
  'sent',
  'viewed',
] as const;
export type MessageStatusType = (typeof MessageStatuses)[number];
