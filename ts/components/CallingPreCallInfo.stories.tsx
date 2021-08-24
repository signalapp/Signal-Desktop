// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { times, range } from 'lodash';
import { storiesOf } from '@storybook/react';
import { setup as setupI18n } from '../../js/modules/i18n';
import enMessages from '../../_locales/en/messages.json';
import { getDefaultConversation } from '../test-both/helpers/getDefaultConversation';

import { CallingPreCallInfo } from './CallingPreCallInfo';

const i18n = setupI18n('en', enMessages);
const getDefaultGroupConversation = () =>
  getDefaultConversation({
    name: 'Tahoe Trip',
    phoneNumber: undefined,
    profileName: undefined,
    title: 'Tahoe Trip',
    type: 'group',
  });
const otherMembers = times(6, () => getDefaultConversation());

const story = storiesOf('Components/CallingPreCallInfo', module);

story.add('Direct conversation', () => (
  <CallingPreCallInfo
    conversation={getDefaultConversation()}
    i18n={i18n}
    me={getDefaultConversation()}
  />
));

story.add('Group conversation, empty group', () => (
  <CallingPreCallInfo
    conversation={getDefaultGroupConversation()}
    groupMembers={[]}
    i18n={i18n}
    me={getDefaultConversation()}
    peekedParticipants={[]}
  />
));

times(5, numberOfOtherPeople => {
  story.add(
    `Group conversation, group has ${numberOfOtherPeople} other member${
      numberOfOtherPeople === 1 ? '' : 's'
    }`,
    () => (
      <CallingPreCallInfo
        conversation={getDefaultGroupConversation()}
        groupMembers={otherMembers.slice(0, numberOfOtherPeople)}
        i18n={i18n}
        me={getDefaultConversation()}
        peekedParticipants={[]}
      />
    )
  );
});

range(1, 5).forEach(numberOfOtherPeople => {
  story.add(
    `Group conversation, ${numberOfOtherPeople} peeked participant${
      numberOfOtherPeople === 1 ? '' : 's'
    }`,
    () => (
      <CallingPreCallInfo
        conversation={getDefaultGroupConversation()}
        groupMembers={otherMembers}
        i18n={i18n}
        me={getDefaultConversation()}
        peekedParticipants={otherMembers.slice(0, numberOfOtherPeople)}
      />
    )
  );
});

story.add('Group conversation, you on an other device', () => {
  const me = getDefaultConversation();
  return (
    <CallingPreCallInfo
      conversation={getDefaultGroupConversation()}
      groupMembers={otherMembers}
      i18n={i18n}
      me={me}
      peekedParticipants={[me]}
    />
  );
});

story.add('Group conversation, call is full', () => (
  <CallingPreCallInfo
    conversation={getDefaultGroupConversation()}
    groupMembers={otherMembers}
    i18n={i18n}
    isCallFull
    me={getDefaultConversation()}
    peekedParticipants={otherMembers}
  />
));
