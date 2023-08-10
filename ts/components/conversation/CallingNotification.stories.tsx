// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';

import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import { CallMode } from '../../types/Calling';
import { generateAci } from '../../types/ServiceId';
import { CallingNotification, type PropsType } from './CallingNotification';
import {
  getDefaultConversation,
  getDefaultGroup,
} from '../../test-both/helpers/getDefaultConversation';
import type { CallStatus } from '../../types/CallDisposition';
import {
  CallType,
  CallDirection,
  GroupCallStatus,
  DirectCallStatus,
} from '../../types/CallDisposition';
import type { ConversationType } from '../../state/ducks/conversations';
import { CallExternalState } from '../../util/callingNotification';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/Conversation/CallingNotification',
};

const getCommonProps = (options: {
  mode: CallMode;
  type?: CallType;
  direction?: CallDirection;
  status?: CallStatus;
  callCreator?: ConversationType | null;
  callExternalState?: CallExternalState;
}): PropsType => {
  const {
    mode,
    type = mode === CallMode.Group ? CallType.Group : CallType.Audio,
    direction = CallDirection.Outgoing,
    status = mode === CallMode.Group
      ? GroupCallStatus.GenericGroupCall
      : DirectCallStatus.Pending,
    callCreator = getDefaultConversation({
      uuid: generateAci(),
      isMe: direction === CallDirection.Outgoing,
    }),
    callExternalState = CallExternalState.Active,
  } = options;

  const conversation =
    mode === CallMode.Group ? getDefaultGroup() : getDefaultConversation();

  return {
    conversationId: conversation.id,
    i18n,
    isNextItemCallingNotification: false,
    returnToActiveCall: action('returnToActiveCall'),
    startCallingLobby: action('startCallingLobby'),
    callHistory: {
      callId: '123',
      peerId: conversation.id,
      ringerId: callCreator?.uuid ?? null,
      mode,
      type,
      direction,
      timestamp: Date.now(),
      status,
    },
    callCreator,
    callExternalState,
    maxDevices: mode === CallMode.Group ? 15 : 0,
    deviceCount:
      // eslint-disable-next-line no-nested-ternary
      mode === CallMode.Group
        ? callExternalState === CallExternalState.Full
          ? 15
          : 13
        : Infinity,
  };
};

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
      {...getCommonProps({
        mode: CallMode.Direct,
        type: CallType.Audio,
        direction: CallDirection.Incoming,
        status: DirectCallStatus.Accepted,
      })}
    />
  );
}

export function AcceptedIncomingVideoCall(): JSX.Element {
  return (
    <CallingNotification
      {...getCommonProps({
        mode: CallMode.Direct,
        type: CallType.Video,
        direction: CallDirection.Incoming,
        status: DirectCallStatus.Accepted,
        callExternalState: CallExternalState.Ended,
      })}
    />
  );
}

export function DeclinedIncomingAudioCall(): JSX.Element {
  return (
    <CallingNotification
      {...getCommonProps({
        mode: CallMode.Direct,
        type: CallType.Audio,
        direction: CallDirection.Incoming,
        status: DirectCallStatus.Declined,
      })}
    />
  );
}

export function DeclinedIncomingVideoCall(): JSX.Element {
  return (
    <CallingNotification
      {...getCommonProps({
        mode: CallMode.Direct,
        type: CallType.Video,
        direction: CallDirection.Incoming,
        status: DirectCallStatus.Declined,
      })}
    />
  );
}

export function AcceptedOutgoingAudioCall(): JSX.Element {
  return (
    <CallingNotification
      {...getCommonProps({
        mode: CallMode.Direct,
        type: CallType.Audio,
        direction: CallDirection.Outgoing,
        status: DirectCallStatus.Accepted,
      })}
    />
  );
}

export function AcceptedOutgoingVideoCall(): JSX.Element {
  return (
    <CallingNotification
      {...getCommonProps({
        mode: CallMode.Direct,
        type: CallType.Video,
        direction: CallDirection.Outgoing,
        status: DirectCallStatus.Accepted,
      })}
    />
  );
}

export function DeclinedOutgoingAudioCall(): JSX.Element {
  return (
    <CallingNotification
      {...getCommonProps({
        mode: CallMode.Direct,
        type: CallType.Audio,
        direction: CallDirection.Outgoing,
        status: DirectCallStatus.Declined,
      })}
    />
  );
}

export function DeclinedOutgoingVideoCall(): JSX.Element {
  return (
    <CallingNotification
      {...getCommonProps({
        mode: CallMode.Direct,
        type: CallType.Video,
        direction: CallDirection.Outgoing,
        status: DirectCallStatus.Declined,
      })}
    />
  );
}

export function TwoIncomingDirectCallsBackToBack(): JSX.Element {
  return (
    <>
      <CallingNotification
        {...getCommonProps({
          mode: CallMode.Direct,
          type: CallType.Video,
          direction: CallDirection.Incoming,
          status: DirectCallStatus.Declined,
          callExternalState: CallExternalState.Ended,
        })}
        isNextItemCallingNotification
      />
      <CallingNotification
        {...getCommonProps({
          mode: CallMode.Direct,
          type: CallType.Audio,
          direction: CallDirection.Incoming,
          status: DirectCallStatus.Declined,
        })}
      />
    </>
  );
}

TwoIncomingDirectCallsBackToBack.story = {
  name: 'Two incoming direct calls back-to-back',
};

export function TwoOutgoingDirectCallsBackToBack(): JSX.Element {
  return (
    <>
      <CallingNotification
        {...getCommonProps({
          mode: CallMode.Direct,
          type: CallType.Video,
          direction: CallDirection.Outgoing,
          status: DirectCallStatus.Declined,
          callExternalState: CallExternalState.Ended,
        })}
        isNextItemCallingNotification
      />
      <CallingNotification
        {...getCommonProps({
          mode: CallMode.Direct,
          type: CallType.Audio,
          direction: CallDirection.Outgoing,
          status: DirectCallStatus.Declined,
        })}
      />
    </>
  );
}

TwoOutgoingDirectCallsBackToBack.story = {
  name: 'Two outgoing direct calls back-to-back',
};

export function GroupCallByUnknown(): JSX.Element {
  return (
    <CallingNotification
      {...getCommonProps({
        mode: CallMode.Group,
        type: CallType.Group,
        direction: CallDirection.Incoming,
        status: GroupCallStatus.Accepted,
        callCreator: null,
      })}
    />
  );
}

export function GroupCallByYou(): JSX.Element {
  return (
    <CallingNotification
      {...getCommonProps({
        mode: CallMode.Group,
        type: CallType.Group,
        direction: CallDirection.Outgoing,
        status: GroupCallStatus.Accepted,
      })}
    />
  );
}

export function GroupCallBySomeone(): JSX.Element {
  return (
    <CallingNotification
      {...getCommonProps({
        mode: CallMode.Group,
        type: CallType.Group,
        direction: CallDirection.Incoming,
        status: GroupCallStatus.GenericGroupCall,
      })}
    />
  );
}

export function GroupCallStartedBySomeoneWithALongName(): JSX.Element {
  return (
    <CallingNotification
      {...getCommonProps({
        mode: CallMode.Group,
        type: CallType.Group,
        direction: CallDirection.Incoming,
        status: GroupCallStatus.GenericGroupCall,
        callCreator: getDefaultConversation({
          name: '😤🪐🦆'.repeat(50),
        }),
      })}
    />
  );
}

GroupCallStartedBySomeoneWithALongName.story = {
  name: 'Group call: started by someone with a long name',
};

export function GroupCallActiveCallFull(): JSX.Element {
  return (
    <CallingNotification
      {...getCommonProps({
        mode: CallMode.Group,
        type: CallType.Group,
        direction: CallDirection.Incoming,
        status: GroupCallStatus.GenericGroupCall,
        callExternalState: CallExternalState.Full,
      })}
    />
  );
}

GroupCallActiveCallFull.story = {
  name: 'Group call: active, call full',
};

export function GroupCallEnded(): JSX.Element {
  return (
    <CallingNotification
      {...getCommonProps({
        mode: CallMode.Group,
        type: CallType.Group,
        direction: CallDirection.Incoming,
        status: GroupCallStatus.GenericGroupCall,
        callExternalState: CallExternalState.Ended,
      })}
    />
  );
}

GroupCallEnded.story = {
  name: 'Group call: ended',
};
