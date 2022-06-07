// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { times } from 'lodash';

import { action } from '@storybook/addon-actions';

import { UUID } from '../../../types/UUID';
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
};

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
};

const OUR_UUID = UUID.generate().toString();

const useProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  approvePendingMembership: action('approvePendingMembership'),
  conversation,
  getPreferredBadge: () => undefined,
  i18n,
  ourUuid: OUR_UUID,
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
        addedByUserId: UUID.generate().toString(),
      },
    })),
  ],
  revokePendingMemberships: action('revokePendingMemberships'),
  theme: React.useContext(StorybookThemeContext),
  ...overrideProps,
});

export const Basic = (): JSX.Element => {
  const props = useProps();

  return <PendingInvites {...props} />;
};

export const WithBadges = (): JSX.Element => {
  const props = useProps({ getPreferredBadge: () => getFakeBadge() });

  return <PendingInvites {...props} />;
};

WithBadges.story = {
  name: 'With badges',
};
