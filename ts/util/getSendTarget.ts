// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.d';

export function getSendTarget({
  uuid,
  e164,
}: Pick<ConversationAttributesType, 'uuid' | 'e164'>): string | undefined {
  return uuid || e164;
}
