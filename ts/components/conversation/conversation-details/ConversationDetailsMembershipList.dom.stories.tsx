// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import { getDefaultConversation } from '../../../test-helpers/getDefaultConversation.std.js';
import { ThemeType } from '../../../types/Util.std.js';

import type {
  Props,
  GroupV2Membership,
} from './ConversationDetailsMembershipList.dom.js';
import { ConversationDetailsMembershipList } from './ConversationDetailsMembershipList.dom.js';

const { i18n } = window.SignalContext;

export default {
  title:
    'Components/Conversation/ConversationDetails/ConversationDetailsMembershipList',
  argTypes: {},
  args: {
    canAddNewMembers: false,
    conversationId: '123',
    getPreferredBadge: () => undefined,
    i18n,
    memberships: [],
    showContactModal: action('showContactModal'),
    startAddingNewMembers: action('startAddingNewMembers'),
    theme: ThemeType.light,
  },
} satisfies Meta<Props>;

const createMemberships = (
  numberOfMemberships = 10
): Array<GroupV2Membership> => {
  return Array.from(new Array(numberOfMemberships)).map(
    (_, i): GroupV2Membership => ({
      isAdmin: i % 3 === 0,
      member: getDefaultConversation({
        isMe: i === 2,
      }),
    })
  );
};

export function Few(args: Props): JSX.Element {
  const memberships = createMemberships(3);
  return (
    <ConversationDetailsMembershipList {...args} memberships={memberships} />
  );
}

export function Limit(args: Props): JSX.Element {
  const memberships = createMemberships(5);
  return (
    <ConversationDetailsMembershipList {...args} memberships={memberships} />
  );
}

export function Limit1(args: Props): JSX.Element {
  const memberships = createMemberships(6);
  return (
    <ConversationDetailsMembershipList {...args} memberships={memberships} />
  );
}

export function Limit2(args: Props): JSX.Element {
  const memberships = createMemberships(7);
  return (
    <ConversationDetailsMembershipList {...args} memberships={memberships} />
  );
}

export function Many(args: Props): JSX.Element {
  const memberships = createMemberships(100);
  return (
    <ConversationDetailsMembershipList {...args} memberships={memberships} />
  );
}

export function None(args: Props): JSX.Element {
  return <ConversationDetailsMembershipList {...args} memberships={[]} />;
}

export function CanAddNewMembers(args: Props): JSX.Element {
  const memberships = createMemberships(10);
  return (
    <ConversationDetailsMembershipList
      {...args}
      memberships={memberships}
      canAddNewMembers
    />
  );
}
