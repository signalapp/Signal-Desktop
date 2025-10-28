// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import lodash from 'lodash';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import { generateAci } from '../../../types/ServiceId.std.js';
import { StorySendMode } from '../../../types/Stories.std.js';
import type { PropsType } from './PendingInvites.dom.js';
import { PendingInvites } from './PendingInvites.dom.js';
import type { ConversationType } from '../../../state/ducks/conversations.preload.js';
import { getDefaultConversation } from '../../../test-helpers/getDefaultConversation.std.js';
import { getFakeBadge } from '../../../test-helpers/getFakeBadge.std.js';
import { StorybookThemeContext } from '../../../../.storybook/StorybookThemeContext.std.js';

const { times } = lodash;

const { i18n } = window.SignalContext;

export default {
  title: 'Components/Conversation/ConversationDetails/PendingInvites',
} satisfies Meta<PropsType>;

const sortedGroupMembers = Array.from(Array(32)).map((_, i) =>
  i === 0
    ? getDefaultConversation({ id: 'def456' })
    : getDefaultConversation({})
);

const conversation: ConversationType = {
  acceptedMessageRequest: true,
  areWeAdmin: true,
  badges: [],
  id: '',
  lastUpdated: 0,
  markedUnread: false,
  isMe: false,
  sortedGroupMembers,
  title: 'Some Conversation',
  type: 'group',
  sharedGroupNames: [],
  acknowledgedGroupNameCollisions: {},
  storySendMode: StorySendMode.IfActive,
};

const OUR_UUID = generateAci();

const useProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  approvePendingMembershipFromGroupV2: action(
    'approvePendingMembershipFromGroupV2'
  ),
  conversation,
  getPreferredBadge: () => undefined,
  i18n,
  ourAci: OUR_UUID,
  pendingApprovalMemberships: times(5, () => ({
    member: getDefaultConversation(),
  })),
  pendingMemberships: [
    ...times(4, () => ({
      member: getDefaultConversation(),
      metadata: {
        addedByUserId: OUR_UUID,
      },
    })),
    ...times(8, () => ({
      member: getDefaultConversation(),
      metadata: {
        addedByUserId: generateAci(),
      },
    })),
  ],
  revokePendingMembershipsFromGroupV2: action(
    'revokePendingMembershipsFromGroupV2'
  ),
  theme: React.useContext(StorybookThemeContext),
  ...overrideProps,
});

export function Basic(): JSX.Element {
  const props = useProps();

  return <PendingInvites {...props} />;
}

export function WithBadges(): JSX.Element {
  const props = useProps({ getPreferredBadge: () => getFakeBadge() });

  return <PendingInvites {...props} />;
}
