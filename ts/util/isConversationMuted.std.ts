// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.d.ts';

export const isConversationMuted = ({
  muteExpiresAt,
}: Readonly<Pick<ConversationAttributesType, 'muteExpiresAt'>>): boolean =>
  Boolean(muteExpiresAt && Date.now() < muteExpiresAt);
