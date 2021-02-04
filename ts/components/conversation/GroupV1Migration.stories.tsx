// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable-next-line max-classes-per-file */
import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { isBoolean } from 'lodash';
import { boolean } from '@storybook/addon-knobs';

import { setup as setupI18n } from '../../../js/modules/i18n';
import enMessages from '../../../_locales/en/messages.json';
import { GroupV1Migration, PropsType } from './GroupV1Migration';

const i18n = setupI18n('en', enMessages);

const contact1 = {
  title: 'Alice',
  number: '+1 (300) 555-000',
  id: 'guid-1',
  markedUnread: false,
  type: 'direct' as const,
  lastUpdated: Date.now(),
};

const contact2 = {
  title: 'Bob',
  number: '+1 (300) 555-000',
  id: 'guid-2',
  markedUnread: false,
  type: 'direct' as const,
  lastUpdated: Date.now(),
};

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  areWeInvited: boolean(
    'areWeInvited',
    isBoolean(overrideProps.areWeInvited) ? overrideProps.areWeInvited : false
  ),
  droppedMembers: overrideProps.droppedMembers || [contact1],
  i18n,
  invitedMembers: overrideProps.invitedMembers || [contact2],
});

const stories = storiesOf('Components/Conversation/GroupV1Migration', module);

stories.add('You were invited', () => (
  <GroupV1Migration
    {...createProps({
      areWeInvited: true,
    })}
  />
));

stories.add('Single dropped and single invited member', () => (
  <GroupV1Migration {...createProps()} />
));

stories.add('Multiple dropped and invited members', () => (
  <GroupV1Migration
    {...createProps({
      invitedMembers: [contact1, contact2],
      droppedMembers: [contact1, contact2],
    })}
  />
));

stories.add('Just invited members', () => (
  <GroupV1Migration
    {...createProps({
      invitedMembers: [contact1, contact1, contact2, contact2],
      droppedMembers: [],
    })}
  />
));

stories.add('Just dropped members', () => (
  <GroupV1Migration
    {...createProps({
      invitedMembers: [],
      droppedMembers: [contact1, contact1, contact2, contact2],
    })}
  />
));

stories.add('No dropped or invited members', () => (
  <GroupV1Migration
    {...createProps({
      invitedMembers: [],
      droppedMembers: [],
    })}
  />
));
