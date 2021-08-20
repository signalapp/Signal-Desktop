// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationType } from '../state/ducks/conversations';

export function getParticipantName(
  participant: Readonly<Pick<ConversationType, 'firstName' | 'title'>>
): string {
  return participant.firstName || participant.title;
}
