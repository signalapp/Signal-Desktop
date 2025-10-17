// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import lodash from 'lodash';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import { getDefaultConversation } from '../../test-helpers/getDefaultConversation.std.js';
import type { PropsType } from './ContactSpoofingReviewDialog.dom.js';
import { ContactSpoofingReviewDialog } from './ContactSpoofingReviewDialog.dom.js';
import { ContactSpoofingType } from '../../util/contactSpoofing.std.js';
import { ThemeType } from '../../types/Util.std.js';

const { times } = lodash;

const { i18n } = window.SignalContext;

export default {
  title: 'Components/Conversation/ContactSpoofingReviewDialog',
} satisfies Meta<PropsType>;

const getCommonProps = () => ({
  acceptConversation: action('acceptConversation'),
  reportSpam: action('reportSpam'),
  blockAndReportSpam: action('blockAndReportSpam'),
  blockConversation: action('blockConversation'),
  conversationId: 'some-conversation-id',
  deleteConversation: action('deleteConversation'),
  getPreferredBadge: () => undefined,
  groupConversationId: 'convo-id',
  i18n,
  onClose: action('onClose'),
  showContactModal: action('showContactModal'),
  toggleSignalConnectionsModal: action('toggleSignalConnectionsModal'),
  updateSharedGroups: action('updateSharedGroups'),
  removeMember: action('removeMember'),
  theme: ThemeType.light,
});

export function DirectConversationsWithSameTitle(): JSX.Element {
  return (
    <ContactSpoofingReviewDialog
      {...getCommonProps()}
      type={ContactSpoofingType.DirectConversationWithSameTitle}
      possiblyUnsafe={{
        conversation: getDefaultConversation(),
        isSignalConnection: false,
      }}
      safe={{
        conversation: getDefaultConversation(),
        isSignalConnection: true,
      }}
    />
  );
}

export function NotAdminMany(): JSX.Element {
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
          isSignalConnection: false,
          conversation: getDefaultConversation({ title: 'Alice' }),
        })),
        Bob: times(3, () => ({
          isSignalConnection: false,
          conversation: getDefaultConversation({ title: 'Bob' }),
        })),
        Charlie: times(5, () => ({
          isSignalConnection: false,
          conversation: getDefaultConversation({ title: 'Charlie' }),
        })),
      }}
    />
  );
}

export function NotAdminOne(): JSX.Element {
  return (
    <ContactSpoofingReviewDialog
      {...getCommonProps()}
      type={ContactSpoofingType.MultipleGroupMembersWithSameTitle}
      group={{
        ...getDefaultConversation(),
        areWeAdmin: false,
      }}
      collisionInfoByTitle={{
        Alice: [
          {
            oldName: 'Alicia',
            isSignalConnection: false,
            conversation: getDefaultConversation({ title: 'Alice' }),
          },
          {
            oldName: 'Alice',
            isSignalConnection: true,
            conversation: getDefaultConversation({ title: 'Alice' }),
          },
        ],
      }}
    />
  );
}

export function AdminMany(): JSX.Element {
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
          isSignalConnection: false,
          conversation: getDefaultConversation({ title: 'Alice' }),
        })),
        Bob: times(3, () => ({
          isSignalConnection: false,
          conversation: getDefaultConversation({ title: 'Bob' }),
        })),
        Charlie: times(5, () => ({
          isSignalConnection: false,
          conversation: getDefaultConversation({ title: 'Charlie' }),
        })),
      }}
    />
  );
}

export function AdminOne(): JSX.Element {
  return (
    <ContactSpoofingReviewDialog
      {...getCommonProps()}
      type={ContactSpoofingType.MultipleGroupMembersWithSameTitle}
      group={{
        ...getDefaultConversation(),
        areWeAdmin: true,
      }}
      collisionInfoByTitle={{
        Alice: [
          {
            oldName: 'Alicia',
            isSignalConnection: false,
            conversation: getDefaultConversation({ title: 'Alice' }),
          },
          {
            isSignalConnection: true,
            conversation: getDefaultConversation({ title: 'Alice' }),
          },
        ],
      }}
    />
  );
}
