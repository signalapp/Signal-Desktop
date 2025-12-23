// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import {
  CallMode,
  CallType,
  CallDirection,
  GroupCallStatus,
  DirectCallStatus,
} from '../../types/CallDisposition.std.js';
import { generateAci } from '../../types/ServiceId.std.js';
import {
  CallingNotification,
  type PropsType,
} from './CallingNotification.dom.js';
import {
  getDefaultConversation,
  getDefaultGroup,
} from '../../test-helpers/getDefaultConversation.std.js';
import type { CallStatus } from '../../types/CallDisposition.std.js';
import type { ConversationType } from '../../state/ducks/conversations.preload.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/Conversation/CallingNotification',
} satisfies Meta<PropsType>;

const getCommonProps = (options: {
  activeConversationId?: string;
  mode: CallMode;
  type?: CallType;
  direction?: CallDirection;
  status?: CallStatus;
  callCreator?: ConversationType | null;
  groupCallEnded: boolean | null;
  deviceCount: number;
  maxDevices: number;
}): PropsType => {
  const {
    mode,
    type = mode === CallMode.Group ? CallType.Group : CallType.Audio,
    direction = CallDirection.Outgoing,
    status = mode === CallMode.Group
      ? GroupCallStatus.GenericGroupCall
      : DirectCallStatus.Pending,
    callCreator = getDefaultConversation({
      serviceId: generateAci(),
      isMe: direction === CallDirection.Outgoing,
    }),
    groupCallEnded,
    deviceCount,
    maxDevices,
  } = options;

  const conversation =
    mode === CallMode.Group ? getDefaultGroup() : getDefaultConversation();

  return {
    id: 'message-id',
    conversationId: conversation.id,
    i18n,
    isNextItemCallingNotification: false,
    onOutgoingAudioCallInConversation: action(
      'onOutgoingAudioCallInConversation'
    ),
    onOutgoingVideoCallInConversation: action(
      'onOutgoingVideoCallInConversation'
    ),
    toggleDeleteMessagesModal: action('toggleDeleteMessagesModal'),
    returnToActiveCall: action('returnToActiveCall'),
    callHistory: {
      callId: '123',
      peerId: conversation.id,
      ringerId: callCreator?.serviceId ?? null,
      startedById: null,
      mode,
      type,
      direction,
      timestamp: Date.now(),
      status,
      endedTimestamp: null,
    },
    callCreator,
    activeConversationId: options.activeConversationId ?? null,
    groupCallEnded,
    maxDevices,
    deviceCount,
    isSelectMode: false,
    isTargeted: false,
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

export function AcceptedIncomingAudioCall(): React.JSX.Element {
  return (
    <CallingNotification
      {...getCommonProps({
        mode: CallMode.Direct,
        type: CallType.Audio,
        direction: CallDirection.Incoming,
        status: DirectCallStatus.Accepted,
        groupCallEnded: null,
        deviceCount: 0,
        maxDevices: Infinity,
      })}
    />
  );
}

export function AcceptedIncomingAudioCallWithActiveCall(): React.JSX.Element {
  return (
    <CallingNotification
      {...getCommonProps({
        mode: CallMode.Direct,
        type: CallType.Audio,
        direction: CallDirection.Incoming,
        status: DirectCallStatus.Accepted,
        groupCallEnded: null,
        deviceCount: 0,
        maxDevices: Infinity,
        activeConversationId: 'someOtherConversation',
      })}
    />
  );
}

export function AcceptedIncomingAudioCallInCurrentCall(): React.JSX.Element {
  const props = getCommonProps({
    mode: CallMode.Direct,
    type: CallType.Audio,
    direction: CallDirection.Incoming,
    status: DirectCallStatus.Accepted,
    groupCallEnded: null,
    deviceCount: 0,
    maxDevices: Infinity,
  });

  return (
    <CallingNotification
      {...props}
      activeConversationId={props.conversationId}
    />
  );
}

export function AcceptedIncomingVideoCall(): React.JSX.Element {
  return (
    <CallingNotification
      {...getCommonProps({
        mode: CallMode.Direct,
        type: CallType.Video,
        direction: CallDirection.Incoming,
        status: DirectCallStatus.Accepted,
        groupCallEnded: null,
        deviceCount: 0,
        maxDevices: Infinity,
      })}
    />
  );
}

export function DeclinedIncomingAudioCall(): React.JSX.Element {
  return (
    <CallingNotification
      {...getCommonProps({
        mode: CallMode.Direct,
        type: CallType.Audio,
        direction: CallDirection.Incoming,
        status: DirectCallStatus.Declined,
        groupCallEnded: null,
        deviceCount: 0,
        maxDevices: Infinity,
      })}
    />
  );
}

export function DeclinedIncomingVideoCall(): React.JSX.Element {
  return (
    <CallingNotification
      {...getCommonProps({
        mode: CallMode.Direct,
        type: CallType.Video,
        direction: CallDirection.Incoming,
        status: DirectCallStatus.Declined,
        groupCallEnded: null,
        deviceCount: 0,
        maxDevices: Infinity,
      })}
    />
  );
}

export function AcceptedOutgoingAudioCall(): React.JSX.Element {
  return (
    <CallingNotification
      {...getCommonProps({
        mode: CallMode.Direct,
        type: CallType.Audio,
        direction: CallDirection.Outgoing,
        status: DirectCallStatus.Accepted,
        groupCallEnded: null,
        deviceCount: 0,
        maxDevices: Infinity,
      })}
    />
  );
}

export function AcceptedOutgoingVideoCall(): React.JSX.Element {
  return (
    <CallingNotification
      {...getCommonProps({
        mode: CallMode.Direct,
        type: CallType.Video,
        direction: CallDirection.Outgoing,
        status: DirectCallStatus.Accepted,
        groupCallEnded: null,
        deviceCount: 0,
        maxDevices: Infinity,
      })}
    />
  );
}

export function DeclinedOutgoingAudioCall(): React.JSX.Element {
  return (
    <CallingNotification
      {...getCommonProps({
        mode: CallMode.Direct,
        type: CallType.Audio,
        direction: CallDirection.Outgoing,
        status: DirectCallStatus.Declined,
        groupCallEnded: null,
        deviceCount: 0,
        maxDevices: Infinity,
      })}
    />
  );
}

export function DeclinedOutgoingVideoCall(): React.JSX.Element {
  return (
    <CallingNotification
      {...getCommonProps({
        mode: CallMode.Direct,
        type: CallType.Video,
        direction: CallDirection.Outgoing,
        status: DirectCallStatus.Declined,
        groupCallEnded: null,
        deviceCount: 0,
        maxDevices: Infinity,
      })}
    />
  );
}

export function TwoIncomingDirectCallsBackToBack(): React.JSX.Element {
  return (
    <>
      <CallingNotification
        {...getCommonProps({
          mode: CallMode.Direct,
          type: CallType.Video,
          direction: CallDirection.Incoming,
          status: DirectCallStatus.Declined,
          groupCallEnded: null,
          deviceCount: 0,
          maxDevices: Infinity,
        })}
        isNextItemCallingNotification
      />
      <CallingNotification
        {...getCommonProps({
          mode: CallMode.Direct,
          type: CallType.Audio,
          direction: CallDirection.Incoming,
          status: DirectCallStatus.Declined,
          groupCallEnded: null,
          deviceCount: 0,
          maxDevices: Infinity,
        })}
      />
    </>
  );
}

export function TwoOutgoingDirectCallsBackToBack(): React.JSX.Element {
  return (
    <>
      <CallingNotification
        {...getCommonProps({
          mode: CallMode.Direct,
          type: CallType.Video,
          direction: CallDirection.Outgoing,
          status: DirectCallStatus.Declined,
          groupCallEnded: null,
          deviceCount: 0,
          maxDevices: Infinity,
        })}
        isNextItemCallingNotification
      />
      <CallingNotification
        {...getCommonProps({
          mode: CallMode.Direct,
          type: CallType.Audio,
          direction: CallDirection.Outgoing,
          status: DirectCallStatus.Declined,
          groupCallEnded: null,
          deviceCount: 0,
          maxDevices: Infinity,
        })}
      />
    </>
  );
}

export function GroupCallByUnknown(): React.JSX.Element {
  return (
    <CallingNotification
      {...getCommonProps({
        mode: CallMode.Group,
        type: CallType.Group,
        direction: CallDirection.Incoming,
        status: GroupCallStatus.Accepted,
        callCreator: null,
        groupCallEnded: false,
        deviceCount: 1,
        maxDevices: 8,
      })}
    />
  );
}

export function GroupCallByYou(): React.JSX.Element {
  return (
    <CallingNotification
      {...getCommonProps({
        mode: CallMode.Group,
        type: CallType.Group,
        direction: CallDirection.Outgoing,
        status: GroupCallStatus.Accepted,
        groupCallEnded: false,
        deviceCount: 1,
        maxDevices: 8,
      })}
    />
  );
}

export function GroupCallBySomeone(): React.JSX.Element {
  return (
    <CallingNotification
      {...getCommonProps({
        mode: CallMode.Group,
        type: CallType.Group,
        direction: CallDirection.Incoming,
        status: GroupCallStatus.GenericGroupCall,
        groupCallEnded: false,
        deviceCount: 1,
        maxDevices: 8,
      })}
    />
  );
}

export function GroupCallStartedBySomeoneWithALongName(): React.JSX.Element {
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
        groupCallEnded: false,
        deviceCount: 1,
        maxDevices: 8,
      })}
    />
  );
}

export function GroupCallActiveCallFull(): React.JSX.Element {
  return (
    <CallingNotification
      {...getCommonProps({
        mode: CallMode.Group,
        type: CallType.Group,
        direction: CallDirection.Incoming,
        status: GroupCallStatus.GenericGroupCall,
        groupCallEnded: false,
        deviceCount: 8,
        maxDevices: 8,
      })}
    />
  );
}

export function GroupCallActiveInAnotherCall(): React.JSX.Element {
  return (
    <CallingNotification
      {...getCommonProps({
        mode: CallMode.Group,
        type: CallType.Group,
        direction: CallDirection.Incoming,
        status: GroupCallStatus.GenericGroupCall,
        groupCallEnded: false,
        deviceCount: 8,
        maxDevices: 10,
        activeConversationId: 'someOtherId',
      })}
    />
  );
}

export function GroupCallActiveInCurrentCall(): React.JSX.Element {
  const props = getCommonProps({
    mode: CallMode.Group,
    type: CallType.Group,
    direction: CallDirection.Incoming,
    status: GroupCallStatus.GenericGroupCall,
    groupCallEnded: false,
    deviceCount: 8,
    maxDevices: 10,
  });

  return (
    <CallingNotification
      {...props}
      activeConversationId={props.conversationId}
    />
  );
}

export function GroupCallEnded(): React.JSX.Element {
  return (
    <CallingNotification
      {...getCommonProps({
        mode: CallMode.Group,
        type: CallType.Group,
        direction: CallDirection.Incoming,
        status: GroupCallStatus.GenericGroupCall,
        groupCallEnded: true,
        deviceCount: 0,
        maxDevices: Infinity,
      })}
    />
  );
}
