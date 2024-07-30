// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import type { Meta } from '@storybook/react';
import { getDefaultConversation } from '../../test-both/helpers/getDefaultConversation';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import type { PropsType } from './GroupV1Migration';
import { GroupV1Migration } from './GroupV1Migration';
import { ThemeType } from '../../types/Util';

const i18n = setupI18n('en', enMessages);

const contact1 = getDefaultConversation({
  title: 'Alice',
  phoneNumber: '+1 (300) 555-000',
  id: 'guid-1',
});

const contact2 = getDefaultConversation({
  title: 'Bob',
  phoneNumber: '+1 (300) 555-000',
  id: 'guid-2',
});

export default {
  title: 'Components/Conversation/GroupV1Migration',
  argTypes: {
    areWeInvited: { control: { type: 'boolean' } },
  },
  args: {
    areWeInvited: false,
    conversationId: '123',
    droppedMembers: [contact1],
    droppedMemberCount: 1,
    getPreferredBadge: () => undefined,
    i18n,
    invitedMembers: [contact2],
    invitedMemberCount: 1,
    theme: ThemeType.light,
  },
} satisfies Meta<PropsType>;

export function YouWereInvited(args: PropsType): JSX.Element {
  return <GroupV1Migration {...args} areWeInvited />;
}

export function SingleDroppedAndSingleInvitedMember(
  args: PropsType
): JSX.Element {
  return <GroupV1Migration {...args} />;
}

export function MultipleDroppedAndInvitedMembers(args: PropsType): JSX.Element {
  return (
    <GroupV1Migration
      {...args}
      invitedMembers={[contact1, contact2]}
      invitedMemberCount={3}
      droppedMembers={[contact1, contact2]}
      droppedMemberCount={3}
    />
  );
}

export function JustInvitedMembers(args: PropsType): JSX.Element {
  return (
    <GroupV1Migration
      {...args}
      invitedMembers={[contact1, contact1, contact2, contact2]}
      invitedMemberCount={4}
      droppedMembers={[]}
      droppedMemberCount={0}
    />
  );
}

export function JustDroppedMembers(args: PropsType): JSX.Element {
  return (
    <GroupV1Migration
      {...args}
      invitedMembers={[]}
      invitedMemberCount={0}
      droppedMembers={[contact1, contact1, contact2, contact2]}
      droppedMemberCount={4}
    />
  );
}

export function NoDroppedOrInvitedMembers(args: PropsType): JSX.Element {
  return (
    <GroupV1Migration
      {...args}
      invitedMembers={[]}
      invitedMemberCount={0}
      droppedMembers={[]}
      droppedMemberCount={0}
    />
  );
}

export function NoArraysCountIsZero(args: PropsType): JSX.Element {
  return (
    <GroupV1Migration
      {...args}
      invitedMembers={undefined}
      invitedMemberCount={0}
      droppedMembers={undefined}
      droppedMemberCount={0}
    />
  );
}

export function NoArraysWithCount(args: PropsType): JSX.Element {
  return (
    <GroupV1Migration
      {...args}
      invitedMembers={undefined}
      invitedMemberCount={4}
      droppedMembers={undefined}
      droppedMemberCount={2}
    />
  );
}
