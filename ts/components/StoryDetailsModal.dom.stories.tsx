// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import type { Meta } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { SendStatus } from '../messages/MessageSendState.std.ts';
import type { StorySendStateType } from '../types/Stories.std.ts';
import { StoryDetailsModal } from './StoryDetailsModal.dom.tsx';
import { getDefaultConversation } from '../test-helpers/getDefaultConversation.std.ts';
import { fakeAttachment } from '../test-helpers/fakeAttachment.std.ts';
import { HOUR, MINUTE } from '../util/durations/index.std.ts';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/StoryDetailsModal',
} satisfies Meta;

const NOW = Date.now();
const SENDER = getDefaultConversation();

function getSendState(
  status: SendStatus,
  updatedAt: number
): StorySendStateType {
  return { recipient: getDefaultConversation(), status, updatedAt };
}

const SEND_STATE: Array<StorySendStateType> = [
  getSendState(SendStatus.Viewed, NOW - 5 * MINUTE),
  getSendState(SendStatus.Viewed, NOW - 10 * MINUTE),
  getSendState(SendStatus.Viewed, NOW - 20 * MINUTE),
  getSendState(SendStatus.Delivered, NOW - HOUR),
  getSendState(SendStatus.Delivered, NOW - HOUR),
  getSendState(SendStatus.Delivered, NOW - 2 * HOUR),
  getSendState(SendStatus.Delivered, NOW - 2 * HOUR),
  getSendState(SendStatus.Sent, NOW - 3 * HOUR),
];

export function MyStory(): ReactNode {
  return (
    <StoryDetailsModal
      i18n={i18n}
      getPreferredBadge={() => undefined}
      onClose={action('onClose')}
      saveAttachment={action('saveAttachment')}
      sender={SENDER}
      sendState={SEND_STATE}
      timestamp={NOW - 3 * HOUR}
      expirationTimestamp={undefined}
    />
  );
}

export function OtherStory(): ReactNode {
  return (
    <StoryDetailsModal
      i18n={i18n}
      getPreferredBadge={() => undefined}
      onClose={action('onClose')}
      saveAttachment={action('saveAttachment')}
      sender={SENDER}
      timestamp={NOW - 3 * HOUR}
      expirationTimestamp={undefined}
    />
  );
}

export function WithAttachmentAndExpiration(): ReactNode {
  return (
    <StoryDetailsModal
      i18n={i18n}
      getPreferredBadge={() => undefined}
      onClose={action('onClose')}
      saveAttachment={action('saveAttachment')}
      sender={SENDER}
      timestamp={NOW - 3 * HOUR}
      attachment={fakeAttachment({ size: 1_234_567 })}
      expirationTimestamp={NOW + 21 * HOUR}
      isInternalUser
    />
  );
}
