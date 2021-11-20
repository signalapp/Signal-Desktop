// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable-next-line max-classes-per-file */
import * as React from 'react';
import { storiesOf } from '@storybook/react';
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
