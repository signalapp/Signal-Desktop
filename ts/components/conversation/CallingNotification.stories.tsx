// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import { CallMode } from '../../types/Calling';
import { CallingNotification } from './CallingNotification';
import type { CallingNotificationType } from '../../util/callingNotification';

const i18n = setupI18n('en', enMessages);

const story = storiesOf('Components/Conversation/CallingNotification', module);

const getCommonProps = () => ({
  conversationId: 'fake-conversation-id',
  i18n,
  messageId: 'fake-message-id',
  messageSizeChanged: action('messageSizeChanged'),
  nextItem: undefined,
  returnToActiveCall: action('returnToActiveCall'),
  startCallingLobby: action('startCallingLobby'),
});

[false, true].forEach(wasIncoming => {
  [false, true].forEach(wasVideoCall => {
    [false, true].forEach(wasDeclined => {
      const direction = wasIncoming ? 'incoming' : 'outgoing';
      const type = wasVideoCall ? 'video' : 'audio';
      const acceptance = wasDeclined ? 'declined' : 'accepted';
      const storyName = `Direct call: ${direction} ${type} call, ${acceptance}`;

      story.add(storyName, () => (
        <CallingNotification
          {...getCommonProps()}
          acceptedTime={wasDeclined ? undefined : 1618894800000}
          callMode={CallMode.Direct}
          endedTime={1618894800000}
          wasDeclined={wasDeclined}
          wasIncoming={wasIncoming}
          wasVideoCall={wasVideoCall}
        />
      ));
    });
  });
});

story.add('Two incoming direct calls back-to-back', () => {
  const call1: CallingNotificationType = {
    callMode: CallMode.Direct,
    wasIncoming: true,
    wasVideoCall: true,
    wasDeclined: false,
    acceptedTime: 1618894800000,
    endedTime: 1618894800000,
  };
  const call2: CallingNotificationType = {
    callMode: CallMode.Direct,
    wasIncoming: true,
    wasVideoCall: false,
    wasDeclined: false,
    endedTime: 1618894800000,
  };

  return (
    <>
      <CallingNotification
        {...getCommonProps()}
        {...call1}
        nextItem={{ type: 'callHistory', data: call2 }}
      />
      <CallingNotification {...getCommonProps()} {...call2} />
    </>
  );
});

story.add('Two outgoing direct calls back-to-back', () => {
  const call1: CallingNotificationType = {
    callMode: CallMode.Direct,
    wasIncoming: false,
    wasVideoCall: true,
    wasDeclined: false,
    acceptedTime: 1618894800000,
    endedTime: 1618894800000,
  };
  const call2: CallingNotificationType = {
    callMode: CallMode.Direct,
    wasIncoming: false,
    wasVideoCall: false,
    wasDeclined: false,
    endedTime: 1618894800000,
  };

  return (
    <>
      <CallingNotification
        {...getCommonProps()}
        {...call1}
        nextItem={{ type: 'callHistory', data: call2 }}
      />
      <CallingNotification {...getCommonProps()} {...call2} />
    </>
  );
});

[
  undefined,
  { isMe: false, title: 'Alice' },
  { isMe: true, title: 'Alicia' },
].forEach(creator => {
  let startedBy: string;
  if (!creator) {
    startedBy = 'with unknown creator';
  } else if (creator.isMe) {
    startedBy = 'started by you';
  } else {
    startedBy = 'started by someone else';
  }
  const storyName = `Group call: active, ${startedBy}`;

  story.add(storyName, () => (
    <CallingNotification
      {...getCommonProps()}
      callMode={CallMode.Group}
      creator={creator}
      deviceCount={15}
      ended={false}
      maxDevices={16}
      startedTime={1618894800000}
    />
  ));
});

story.add('Group call: started by someone with a long name', () => {
  const longName = '😤🪐🦆'.repeat(50);

  return (
    <CallingNotification
      {...getCommonProps()}
      callMode={CallMode.Group}
      creator={{
        isMe: false,
        title: longName,
      }}
      deviceCount={15}
      ended={false}
      maxDevices={16}
      startedTime={1618894800000}
    />
  );
});

story.add('Group call: active, call full', () => (
  <CallingNotification
    {...getCommonProps()}
    callMode={CallMode.Group}
    deviceCount={16}
    ended={false}
    maxDevices={16}
    startedTime={1618894800000}
  />
));

story.add('Group call: ended', () => (
  <CallingNotification
    {...getCommonProps()}
    callMode={CallMode.Group}
    deviceCount={0}
    ended
    maxDevices={16}
    startedTime={1618894800000}
  />
));
