// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { action } from '@storybook/addon-actions';

import type { Meta } from '@storybook/react';
import type { PropsType } from './GroupV1MigrationDialog';
import { GroupV1MigrationDialog } from './GroupV1MigrationDialog';
import type { ConversationType } from '../state/ducks/conversations';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';
import { getDefaultConversation } from '../test-both/helpers/getDefaultConversation';
import { ThemeType } from '../types/Util';

const i18n = setupI18n('en', enMessages);

const contact1: ConversationType = getDefaultConversation({
  title: 'Alice',
  phoneNumber: '+1 (300) 555-0000',
  id: 'guid-1',
});

const contact2: ConversationType = getDefaultConversation({
  title: 'Bob',
  phoneNumber: '+1 (300) 555-0001',
  id: 'guid-2',
});

const contact3: ConversationType = getDefaultConversation({
  title: 'Chet',
  phoneNumber: '+1 (300) 555-0002',
  id: 'guid-3',
});

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  areWeInvited: Boolean(overrideProps.areWeInvited),
  droppedMembers: overrideProps.droppedMembers,
  droppedMemberCount: overrideProps.droppedMemberCount || 0,
  getPreferredBadge: () => undefined,
  hasMigrated: Boolean(overrideProps.hasMigrated),
  i18n,
  invitedMembers: overrideProps.invitedMembers,
  invitedMemberCount: overrideProps.invitedMemberCount || 0,
  onMigrate: action('onMigrate'),
  onClose: action('onClose'),
  theme: ThemeType.light,
});

export default {
  title: 'Components/GroupV1MigrationDialog',
} satisfies Meta<PropsType>;

export function NotYetMigratedBasic(): JSX.Element {
  return <GroupV1MigrationDialog {...createProps()} />;
}

export function MigratedBasic(): JSX.Element {
  return (
    <GroupV1MigrationDialog
      {...createProps({
        hasMigrated: true,
      })}
    />
  );
}

export function MigratedYouAreInvited(): JSX.Element {
  return (
    <GroupV1MigrationDialog
      {...createProps({
        hasMigrated: true,
        areWeInvited: true,
      })}
    />
  );
}

export function MigratedMultipleDroppedAndInvitedMember(): JSX.Element {
  return (
    <GroupV1MigrationDialog
      {...createProps({
        hasMigrated: true,
        droppedMembers: [contact1],
        droppedMemberCount: 1,
        invitedMembers: [contact2],
        invitedMemberCount: 1,
      })}
    />
  );
}

export function MigratedMultipleDroppedAndInvitedMembers(): JSX.Element {
  return (
    <GroupV1MigrationDialog
      {...createProps({
        hasMigrated: true,
        droppedMembers: [contact3, contact1, contact2],
        droppedMemberCount: 3,
        invitedMembers: [contact2, contact3, contact1],
        invitedMemberCount: 3,
      })}
    />
  );
}

export function MigratedNoMembers(): JSX.Element {
  return (
    <GroupV1MigrationDialog
      {...createProps({
        hasMigrated: true,
        droppedMemberCount: 0,
        invitedMemberCount: 0,
      })}
    />
  );
}

export function NotYetMigratedJustDroppedMember(): JSX.Element {
  return (
    <GroupV1MigrationDialog
      {...createProps({
        droppedMembers: [contact1],
        droppedMemberCount: 1,
      })}
    />
  );
}

export function NotYetMigratedJustDroppedMembers(): JSX.Element {
  return (
    <GroupV1MigrationDialog
      {...createProps({
        droppedMembers: [contact1, contact2],
        droppedMemberCount: 2,
      })}
    />
  );
}

export function NotYetMigratedDropped1(): JSX.Element {
  return (
    <GroupV1MigrationDialog
      {...createProps({
        droppedMemberCount: 1,
        invitedMemberCount: 0,
      })}
    />
  );
}

export function NotYetMigratedDropped2(): JSX.Element {
  return (
    <GroupV1MigrationDialog
      {...createProps({
        droppedMemberCount: 2,
        invitedMemberCount: 0,
      })}
    />
  );
}

export function MigratedJustCountIs1(): JSX.Element {
  return (
    <GroupV1MigrationDialog
      {...createProps({
        hasMigrated: true,
        droppedMemberCount: 1,
        invitedMemberCount: 1,
      })}
    />
  );
}

export function MigratedJustCountIs2(): JSX.Element {
  return (
    <GroupV1MigrationDialog
      {...createProps({
        hasMigrated: true,
        droppedMemberCount: 2,
        invitedMemberCount: 2,
      })}
    />
  );
}
