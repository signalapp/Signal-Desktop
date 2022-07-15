// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { action } from '@storybook/addon-actions';

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
  droppedMembers: overrideProps.droppedMembers || [contact3, contact1],
  getPreferredBadge: () => undefined,
  hasMigrated: Boolean(overrideProps.hasMigrated),
  i18n,
  invitedMembers: overrideProps.invitedMembers || [contact2],
  migrate: action('migrate'),
  onClose: action('onClose'),
  theme: ThemeType.light,
});

export default {
  title: 'Components/GroupV1MigrationDialog',
};

export const NotYetMigratedBasic = (): JSX.Element => {
  return <GroupV1MigrationDialog {...createProps()} />;
};

NotYetMigratedBasic.story = {
  name: 'Not yet migrated, basic',
};

export const MigratedBasic = (): JSX.Element => {
  return (
    <GroupV1MigrationDialog
      {...createProps({
        hasMigrated: true,
      })}
    />
  );
};

MigratedBasic.story = {
  name: 'Migrated, basic',
};

export const MigratedYouAreInvited = (): JSX.Element => {
  return (
    <GroupV1MigrationDialog
      {...createProps({
        hasMigrated: true,
        areWeInvited: true,
      })}
    />
  );
};

MigratedYouAreInvited.story = {
  name: 'Migrated, you are invited',
};

export const NotYetMigratedMultipleDroppedAndInvitedMembers =
  (): JSX.Element => {
    return (
      <GroupV1MigrationDialog
        {...createProps({
          droppedMembers: [contact3, contact1, contact2],
          invitedMembers: [contact2, contact3, contact1],
        })}
      />
    );
  };

NotYetMigratedMultipleDroppedAndInvitedMembers.story = {
  name: 'Not yet migrated, multiple dropped and invited members',
};

export const NotYetMigratedNoMembers = (): JSX.Element => {
  return (
    <GroupV1MigrationDialog
      {...createProps({
        droppedMembers: [],
        invitedMembers: [],
      })}
    />
  );
};

NotYetMigratedNoMembers.story = {
  name: 'Not yet migrated, no members',
};

export const NotYetMigratedJustDroppedMember = (): JSX.Element => {
  return (
    <GroupV1MigrationDialog
      {...createProps({
        invitedMembers: [],
      })}
    />
  );
};

NotYetMigratedJustDroppedMember.story = {
  name: 'Not yet migrated, just dropped member',
};
