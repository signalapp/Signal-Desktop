// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import {
  CallMode,
  CallType,
  CallDirection,
  GroupCallStatus,
  DirectCallStatus,
} from '../../types/CallDisposition';
import { generateAci } from '../../types/ServiceId';
import { CallingNotification, type PropsType } from './CallingNotification';
import {
  getDefaultConversation,
  getDefaultGroup,
} from '../../test-both/helpers/getDefaultConversation';
import type { CallStatus } from '../../types/CallDisposition';
import type { ConversationType } from '../../state/ducks/conversations';

const i18n = setupI18n('en', enMessages);

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
    interactionMode: 'mouse',
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

export function AcceptedIncomingAudioCall(): JSX.Element {
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

export function AcceptedIncomingAudioCallWithActiveCall(): JSX.Element {
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

export function AcceptedIncomingAudioCallInCurrentCall(): JSX.Element {
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

export function AcceptedIncomingVideoCall(): JSX.Element {
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

export function DeclinedIncomingAudioCall(): JSX.Element {
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

export function DeclinedIncomingVideoCall(): JSX.Element {
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

export function AcceptedOutgoingAudioCall(): JSX.Element {
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

export function AcceptedOutgoingVideoCall(): JSX.Element {
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

export function DeclinedOutgoingAudioCall(): JSX.Element {
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

export function DeclinedOutgoingVideoCall(): JSX.Element {
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

export function TwoIncomingDirectCallsBackToBack(): JSX.Element {
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

export function TwoOutgoingDirectCallsBackToBack(): JSX.Element {
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

export function GroupCallByUnknown(): JSX.Element {
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

export function GroupCallByYou(): JSX.Element {
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

export function GroupCallBySomeone(): JSX.Element {
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
        groupCallEnded: false,
        deviceCount: 1,
        maxDevices: 8,
      })}
    />
  );
}

export function GroupCallActiveCallFull(): JSX.Element {
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

export function GroupCallActiveInAnotherCall(): JSX.Element {
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

export function GroupCallActiveInCurrentCall(): JSX.Element {
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

export function GroupCallEnded(): JSX.Element {
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
