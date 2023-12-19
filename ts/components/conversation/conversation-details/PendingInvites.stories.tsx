// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { times } from 'lodash';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import { generateAci } from '../../../types/ServiceId';
import { StorySendMode } from '../../../types/Stories';
import { setupI18n } from '../../../util/setupI18n';
import enMessages from '../../../../_locales/en/messages.json';
import type { PropsType } from './PendingInvites';
import { PendingInvites } from './PendingInvites';
import type { ConversationType } from '../../../state/ducks/conversations';
import { getDefaultConversation } from '../../../test-both/helpers/getDefaultConversation';
import { getFakeBadge } from '../../../test-both/helpers/getFakeBadge';
import { StorybookThemeContext } from '../../../../.storybook/StorybookThemeContext';

const i18n = setupI18n('en', enMessages);

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
