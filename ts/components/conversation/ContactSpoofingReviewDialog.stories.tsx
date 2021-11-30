// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { times } from 'lodash';
import { action } from '@storybook/addon-actions';
import { storiesOf } from '@storybook/react';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import { getDefaultConversation } from '../../test-both/helpers/getDefaultConversation';

import { ContactSpoofingReviewDialog } from './ContactSpoofingReviewDialog';
import { ContactSpoofingType } from '../../util/contactSpoofing';
import { ThemeType } from '../../types/Util';

const i18n = setupI18n('en', enMessages);

const story = storiesOf(
  'Components/Conversation/ContactSpoofingReviewDialog',
  module
);

const getCommonProps = () => ({
  getPreferredBadge: () => undefined,
  i18n,
  onBlock: action('onBlock'),
  onBlockAndReportSpam: action('onBlockAndReportSpam'),
  onClose: action('onClose'),
  onDelete: action('onDelete'),
  onShowContactModal: action('onShowContactModal'),
  onUnblock: action('onUnblock'),
  removeMember: action('removeMember'),
  theme: ThemeType.light,
});

story.add('Direct conversations with same title', () => (
  <ContactSpoofingReviewDialog
    {...getCommonProps()}
    type={ContactSpoofingType.DirectConversationWithSameTitle}
    possiblyUnsafeConversation={getDefaultConversation()}
    safeConversation={getDefaultConversation()}
  />
));

[false, true].forEach(areWeAdmin => {
  story.add(
    `Group conversation many group members${
      areWeAdmin ? " (and we're an admin)" : ''
    }`,
    () => (
      <ContactSpoofingReviewDialog
        {...getCommonProps()}
        type={ContactSpoofingType.MultipleGroupMembersWithSameTitle}
        areWeAdmin={areWeAdmin}
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
    )
  );
});
