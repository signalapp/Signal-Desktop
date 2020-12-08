// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { v4 as generateUuid } from 'uuid';
import { ConversationType } from '../state/ducks/conversations';

export function getDefaultConversation(
  overrideProps: Partial<ConversationType>
): ConversationType {
  if (window.STORYBOOK_ENV !== 'react') {
    throw new Error('getDefaultConversation is for storybook only');
  }

  return {
    id: 'guid-1',
    lastUpdated: Date.now(),
    markedUnread: Boolean(overrideProps.markedUnread),
    e164: '+1300555000',
    title: 'Alice',
    type: 'direct' as const,
    uuid: generateUuid(),
    ...overrideProps,
  };
}
