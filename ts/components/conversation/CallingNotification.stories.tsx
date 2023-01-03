// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';

import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import { CallMode } from '../../types/Calling';
import { CallingNotification } from './CallingNotification';
import type { CallingNotificationType } from '../../util/callingNotification';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/Conversation/CallingNotification',
};

const getCommonProps = () => ({
  conversationId: 'fake-conversation-id',
  i18n,
  isNextItemCallingNotification: false,
  messageId: 'fake-message-id',
  now: Date.now(),
  returnToActiveCall: action('returnToActiveCall'),
  startCallingLobby: action('startCallingLobby'),
});

/*
<CallingNotification
  {...getCommonProps()}
  acceptedTime={wasDeclined ? undefined : 1618894800000}
  callMode={CallMode.Direct}
  endedTime={1618894800000}
  wasDeclined={wasDeclined}
  wasIncoming={wasIncoming}
  wasVideoCall={wasVideoCall}
/>
 */

export function AcceptedIncomingAudioCall(): JSX.Element {
  return (
    <CallingNotification
      {...getCommonProps()}
      acceptedTime={1618894800000}
      callMode={CallMode.Direct}
      endedTime={1618894800000}
      wasDeclined={false}
      wasIncoming
      wasVideoCall={false}
    />
  );
}

export function AcceptedIncomingVideoCall(): JSX.Element {
  return (
    <CallingNotification
      {...getCommonProps()}
      acceptedTime={1618894800000}
      callMode={CallMode.Direct}
      endedTime={1618894800000}
      wasDeclined={false}
      wasIncoming
      wasVideoCall
    />
  );
}

export function DeclinedIncomingAudioCall(): JSX.Element {
  return (
    <CallingNotification
      {...getCommonProps()}
      acceptedTime={undefined}
      callMode={CallMode.Direct}
      endedTime={1618894800000}
      wasDeclined
      wasIncoming
      wasVideoCall={false}
    />
  );
}

export function DeclinedIncomingVideoCall(): JSX.Element {
  return (
    <CallingNotification
      {...getCommonProps()}
      acceptedTime={undefined}
      callMode={CallMode.Direct}
      endedTime={1618894800000}
      wasDeclined
      wasIncoming
      wasVideoCall
    />
  );
}

export function AcceptedOutgoingAudioCall(): JSX.Element {
  return (
    <CallingNotification
      {...getCommonProps()}
      acceptedTime={1618894800000}
      callMode={CallMode.Direct}
      endedTime={1618894800000}
      wasDeclined={false}
      wasIncoming={false}
      wasVideoCall={false}
    />
  );
}

export function AcceptedOutgoingVideoCall(): JSX.Element {
  return (
    <CallingNotification
      {...getCommonProps()}
      acceptedTime={1618894800000}
      callMode={CallMode.Direct}
      endedTime={1618894800000}
      wasDeclined={false}
      wasIncoming={false}
      wasVideoCall
    />
  );
}

export function DeclinedOutgoingAudioCall(): JSX.Element {
  return (
    <CallingNotification
      {...getCommonProps()}
      acceptedTime={undefined}
      callMode={CallMode.Direct}
      endedTime={1618894800000}
      wasDeclined
      wasIncoming={false}
      wasVideoCall={false}
    />
  );
}

export function DeclinedOutgoingVideoCall(): JSX.Element {
  return (
    <CallingNotification
      {...getCommonProps()}
      acceptedTime={undefined}
      callMode={CallMode.Direct}
      endedTime={1618894800000}
      wasDeclined
      wasIncoming={false}
      wasVideoCall
    />
  );
}

export function TwoIncomingDirectCallsBackToBack(): JSX.Element {
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
        isNextItemCallingNotification
      />
      <CallingNotification {...getCommonProps()} {...call2} />
    </>
  );
}

TwoIncomingDirectCallsBackToBack.story = {
  name: 'Two incoming direct calls back-to-back',
};

export function TwoOutgoingDirectCallsBackToBack(): JSX.Element {
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
        isNextItemCallingNotification
      />
      <CallingNotification {...getCommonProps()} {...call2} />
    </>
  );
}

TwoOutgoingDirectCallsBackToBack.story = {
  name: 'Two outgoing direct calls back-to-back',
};

export function GroupCallByUnknown(): JSX.Element {
  return (
    <CallingNotification
      {...getCommonProps()}
      callMode={CallMode.Group}
      creator={undefined}
      deviceCount={15}
      ended={false}
      maxDevices={16}
      startedTime={1618894800000}
    />
  );
}

export function GroupCallByYou(): JSX.Element {
  return (
    <CallingNotification
      {...getCommonProps()}
      callMode={CallMode.Group}
      creator={{ isMe: true, title: 'Alicia' }}
      deviceCount={15}
      ended={false}
      maxDevices={16}
      startedTime={1618894800000}
    />
  );
}

export function GroupCallBySomeone(): JSX.Element {
  return (
    <CallingNotification
      {...getCommonProps()}
      callMode={CallMode.Group}
      creator={{ isMe: false, title: 'Alicia' }}
      deviceCount={15}
      ended={false}
      maxDevices={16}
      startedTime={1618894800000}
    />
  );
}

export function GroupCallStartedBySomeoneWithALongName(): JSX.Element {
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
}

GroupCallStartedBySomeoneWithALongName.story = {
  name: 'Group call: started by someone with a long name',
};

export function GroupCallActiveCallFull(): JSX.Element {
  return (
    <CallingNotification
      {...getCommonProps()}
      callMode={CallMode.Group}
      deviceCount={16}
      ended={false}
      maxDevices={16}
      startedTime={1618894800000}
    />
  );
}

GroupCallActiveCallFull.story = {
  name: 'Group call: active, call full',
};

export function GroupCallEnded(): JSX.Element {
  return (
    <CallingNotification
      {...getCommonProps()}
      callMode={CallMode.Group}
      deviceCount={0}
      ended
      maxDevices={16}
      startedTime={1618894800000}
    />
  );
}

GroupCallEnded.story = {
  name: 'Group call: ended',
};
