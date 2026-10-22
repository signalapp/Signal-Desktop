// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import {
  GroupV1MigrationDialog,
  type GroupV1MigrationDialogProps,
} from './GroupV1MigrationDialog.dom.tsx';
import type { ConversationType } from '../state/ducks/conversations.preload.ts';
import { getDefaultConversation } from '../test-helpers/getDefaultConversation.std.ts';
import { ThemeType } from '../types/Util.std.ts';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/GroupV1MigrationDialog',
} satisfies Meta;

const ALICE: ConversationType = getDefaultConversation({
  title: 'Alice',
  phoneNumber: '+1 (300) 555-0000',
  id: 'guid-1',
});

const BOB: ConversationType = getDefaultConversation({
  title: 'Bob',
  phoneNumber: '+1 (300) 555-0001',
  id: 'guid-2',
});

const CHET: ConversationType = getDefaultConversation({
  title: 'Chet',
  phoneNumber: '+1 (300) 555-0002',
  id: 'guid-3',
});

function getPreferredBadge() {
  return undefined;
}

const DEFAULT_PROPS = {
  i18n,
  getPreferredBadge,
  theme: ThemeType.light,
  onClose: action('onClose'),
} as const satisfies Partial<GroupV1MigrationDialogProps>;

export function Basic(): ReactNode {
  return (
    <GroupV1MigrationDialog
      {...DEFAULT_PROPS}
      areWeInvited={false}
      droppedMembers={null}
      droppedMemberCount={0}
      invitedMembers={null}
      invitedMemberCount={0}
    />
  );
}

export function YouAreInvited(): ReactNode {
  return (
    <GroupV1MigrationDialog
      {...DEFAULT_PROPS}
      areWeInvited
      droppedMembers={null}
      droppedMemberCount={0}
      invitedMembers={null}
      invitedMemberCount={0}
    />
  );
}

export function MultipleDroppedAndInvitedMember(): ReactNode {
  return (
    <GroupV1MigrationDialog
      {...DEFAULT_PROPS}
      areWeInvited={false}
      droppedMembers={[ALICE]}
      droppedMemberCount={1}
      invitedMembers={[BOB]}
      invitedMemberCount={1}
    />
  );
}

export function MultipleDroppedAndInvitedMembers(): ReactNode {
  return (
    <GroupV1MigrationDialog
      {...DEFAULT_PROPS}
      areWeInvited={false}
      droppedMembers={[CHET, ALICE, BOB]}
      droppedMemberCount={3}
      invitedMembers={[BOB, CHET, ALICE]}
      invitedMemberCount={3}
    />
  );
}

export function JustCountIs1(): ReactNode {
  return (
    <GroupV1MigrationDialog
      {...DEFAULT_PROPS}
      areWeInvited={false}
      droppedMembers={null}
      droppedMemberCount={1}
      invitedMembers={null}
      invitedMemberCount={1}
    />
  );
}

export function JustCountIs2(): ReactNode {
  return (
    <GroupV1MigrationDialog
      {...DEFAULT_PROPS}
      areWeInvited={false}
      droppedMembers={null}
      droppedMemberCount={2}
      invitedMembers={null}
      invitedMemberCount={2}
    />
  );
}
