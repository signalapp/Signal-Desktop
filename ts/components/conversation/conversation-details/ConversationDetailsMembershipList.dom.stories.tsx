// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import { getDefaultConversation } from '../../../test-helpers/getDefaultConversation.std.ts';
import { ThemeType } from '../../../types/Util.std.ts';

import type {
  Props,
  GroupV2Membership,
} from './ConversationDetailsMembershipList.dom.tsx';
import { ConversationDetailsMembershipList } from './ConversationDetailsMembershipList.dom.tsx';
import type { ContactNameColorType } from '../../../types/Colors.std.ts';
import { ContactNameColors } from '../../../types/Colors.std.ts';

const { i18n } = window.SignalContext;

const createMemberships = (
  numberOfMemberships = 10
): Array<GroupV2Membership> => {
  return Array.from(new Array(numberOfMemberships)).map(
    (_, i): GroupV2Membership => ({
      isAdmin: i % 4 === 0,
      labelEmoji: i % 6 === 0 ? '🟢' : undefined,
      labelString: i % 3 === 0 ? `Task Wrangler ${i}` : undefined,
      member: getDefaultConversation({
        isMe: i === 2,
      }),
    })
  );
};

const getMemberColors = (
  memberships: Array<GroupV2Membership>
): Map<string, ContactNameColorType> =>
  new Map(
    memberships.map((membership, i) => [
      membership.member.id,
      // oxlint-disable-next-line typescript/no-non-null-assertion
      ContactNameColors[i % ContactNameColors.length]!,
    ])
  );

const defaultMemberships = createMemberships();

export default {
  title:
    'Components/Conversation/ConversationDetails/ConversationDetailsMembershipList',
  argTypes: {},
  args: {
    canAddNewMembers: false,
    conversationId: '123',
    getPreferredBadge: () => undefined,
    i18n,
    isTerminated: false,
    memberships: defaultMemberships,
    memberColors: getMemberColors(defaultMemberships),
    showContactModal: action('showContactModal'),
    startAddingNewMembers: action('startAddingNewMembers'),
    theme: ThemeType.light,
  },
} satisfies Meta<Props>;

export function Few(args: Props): React.JSX.Element {
  const memberships = defaultMemberships.slice(3);
  return (
    <ConversationDetailsMembershipList {...args} memberships={memberships} />
  );
}

export function Limit(args: Props): React.JSX.Element {
  const memberships = defaultMemberships.slice(5);
  return (
    <ConversationDetailsMembershipList {...args} memberships={memberships} />
  );
}

export function Limit1(args: Props): React.JSX.Element {
  const memberships = defaultMemberships.slice(6);
  return (
    <ConversationDetailsMembershipList {...args} memberships={memberships} />
  );
}

export function Limit2(args: Props): React.JSX.Element {
  const memberships = defaultMemberships.slice(7);
  return (
    <ConversationDetailsMembershipList {...args} memberships={memberships} />
  );
}

export function Many(args: Props): React.JSX.Element {
  const memberships = createMemberships(100);
  const memberColors = getMemberColors(memberships);
  return (
    <ConversationDetailsMembershipList
      {...args}
      memberships={memberships}
      memberColors={memberColors}
    />
  );
}

export function None(args: Props): React.JSX.Element {
  return <ConversationDetailsMembershipList {...args} memberships={[]} />;
}

export function CanAddNewMembers(args: Props): React.JSX.Element {
  return <ConversationDetailsMembershipList {...args} canAddNewMembers />;
}
