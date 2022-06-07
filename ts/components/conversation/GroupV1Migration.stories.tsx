// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { isBoolean } from 'lodash';
import { boolean } from '@storybook/addon-knobs';

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

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  areWeInvited: boolean(
    'areWeInvited',
    isBoolean(overrideProps.areWeInvited) ? overrideProps.areWeInvited : false
  ),
  droppedMembers: overrideProps.droppedMembers || [contact1],
  getPreferredBadge: () => undefined,
  i18n,
  invitedMembers: overrideProps.invitedMembers || [contact2],
  theme: ThemeType.light,
});

export default {
  title: 'Components/Conversation/GroupV1Migration',
};

export const YouWereInvited = (): JSX.Element => (
  <GroupV1Migration
    {...createProps({
      areWeInvited: true,
    })}
  />
);

YouWereInvited.story = {
  name: 'You were invited',
};

export const SingleDroppedAndSingleInvitedMember = (): JSX.Element => (
  <GroupV1Migration {...createProps()} />
);

SingleDroppedAndSingleInvitedMember.story = {
  name: 'Single dropped and single invited member',
};

export const MultipleDroppedAndInvitedMembers = (): JSX.Element => (
  <GroupV1Migration
    {...createProps({
      invitedMembers: [contact1, contact2],
      droppedMembers: [contact1, contact2],
    })}
  />
);

MultipleDroppedAndInvitedMembers.story = {
  name: 'Multiple dropped and invited members',
};

export const JustInvitedMembers = (): JSX.Element => (
  <GroupV1Migration
    {...createProps({
      invitedMembers: [contact1, contact1, contact2, contact2],
      droppedMembers: [],
    })}
  />
);

JustInvitedMembers.story = {
  name: 'Just invited members',
};

export const JustDroppedMembers = (): JSX.Element => (
  <GroupV1Migration
    {...createProps({
      invitedMembers: [],
      droppedMembers: [contact1, contact1, contact2, contact2],
    })}
  />
);

JustDroppedMembers.story = {
  name: 'Just dropped members',
};

export const NoDroppedOrInvitedMembers = (): JSX.Element => (
  <GroupV1Migration
    {...createProps({
      invitedMembers: [],
      droppedMembers: [],
    })}
  />
);

NoDroppedOrInvitedMembers.story = {
  name: 'No dropped or invited members',
};
