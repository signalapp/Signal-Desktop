// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationType } from '../state/ducks/conversations';

export function getParticipantName(
  participant: Readonly<
    Pick<
      ConversationType,
      | 'firstName'
      | 'systemGivenName'
      | 'systemNickname'
      | 'title'
      | 'nicknameGivenName'
    >
  >
): string {
  return (
    participant.nicknameGivenName ||
    participant.systemNickname ||
    participant.systemGivenName ||
    participant.firstName ||
    participant.title
  );
}
