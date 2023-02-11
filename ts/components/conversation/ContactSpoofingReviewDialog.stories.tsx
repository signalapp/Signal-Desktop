// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { times } from 'lodash';
import { action } from '@storybook/addon-actions';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import { getDefaultConversation } from '../../test-both/helpers/getDefaultConversation';

import { ContactSpoofingReviewDialog } from './ContactSpoofingReviewDialog';
import { ContactSpoofingType } from '../../util/contactSpoofing';
import { ThemeType } from '../../types/Util';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/Conversation/ContactSpoofingReviewDialog',
};

const getCommonProps = () => ({
  acceptConversation: action('acceptConversation'),
  blockAndReportSpam: action('blockAndReportSpam'),
  blockConversation: action('blockConversation'),
  conversationId: 'some-conversation-id',
  deleteConversation: action('deleteConversation'),
  getPreferredBadge: () => undefined,
  groupConversationId: 'convo-id',
  i18n,
  onClose: action('onClose'),
  showContactModal: action('showContactModal'),
  removeMember: action('removeMember'),
  theme: ThemeType.light,
});

export function DirectConversationsWithSameTitle(): JSX.Element {
  return (
    <ContactSpoofingReviewDialog
      {...getCommonProps()}
      type={ContactSpoofingType.DirectConversationWithSameTitle}
      possiblyUnsafeConversation={getDefaultConversation()}
      safeConversation={getDefaultConversation()}
    />
  );
}

DirectConversationsWithSameTitle.story = {
  name: 'Direct conversations with same title',
};

export function NotAdmin(): JSX.Element {
  return (
    <ContactSpoofingReviewDialog
      {...getCommonProps()}
      type={ContactSpoofingType.MultipleGroupMembersWithSameTitle}
      group={{
        ...getDefaultConversation(),
        areWeAdmin: false,
      }}
      collisionInfoByTitle={{
        Alice: times(2, () => ({
          oldName: 'Alicia',
          conversation: getDefaultConversation({ title: 'Alice' }),
        })),
        Bob: times(3, () => ({
          conversation: getDefaultConversation({ title: 'Bob' }),
        })),
        Charlie: times(5, () => ({
          conversation: getDefaultConversation({ title: 'Charlie' }),
        })),
      }}
    />
  );
}

NotAdmin.story = {
  name: 'Group conversation many group members',
};

export function Admin(): JSX.Element {
  return (
    <ContactSpoofingReviewDialog
      {...getCommonProps()}
      type={ContactSpoofingType.MultipleGroupMembersWithSameTitle}
      group={{
        ...getDefaultConversation(),
        areWeAdmin: true,
      }}
      collisionInfoByTitle={{
        Alice: times(2, () => ({
          oldName: 'Alicia',
          conversation: getDefaultConversation({ title: 'Alice' }),
        })),
        Bob: times(3, () => ({
          conversation: getDefaultConversation({ title: 'Bob' }),
        })),
        Charlie: times(5, () => ({
          conversation: getDefaultConversation({ title: 'Charlie' }),
        })),
      }}
    />
  );
}

Admin.story = {
  name: 'Group conversation many group members, and we are admin',
};
