// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import lodash from 'lodash';
import type { Meta } from '@storybook/react';
import { getDefaultConversation } from '../test-helpers/getDefaultConversation.std.js';
import type { PropsType } from './CallingPreCallInfo.dom.js';
import { CallingPreCallInfo, RingMode } from './CallingPreCallInfo.dom.js';
import type { ConversationType } from '../state/ducks/conversations.preload.js';
import { generateAci } from '../types/ServiceId.std.js';
import { FAKE_CALL_LINK } from '../test-helpers/fakeCallLink.std.js';
import { callLinkToConversation } from '../util/callLinks.std.js';

const { times } = lodash;

const { i18n } = window.SignalContext;
const getDefaultGroupConversation = () =>
  getDefaultConversation({
    name: 'Tahoe Trip',
    phoneNumber: undefined,
    profileName: undefined,
    title: 'Tahoe Trip',
    type: 'group',
  });
const otherMembers = times(6, () => getDefaultConversation());

const getUnknownContact = (): ConversationType => ({
  acceptedMessageRequest: false,
  badges: [],
  id: '123',
  type: 'direct',
  title: i18n('icu:unknownContact'),
  isMe: false,
  serviceId: generateAci(),
});

export default {
  title: 'Components/CallingPreCallInfo',
} satisfies Meta<PropsType>;

export function DirectConversation(): React.JSX.Element {
  return (
    <CallingPreCallInfo
      conversation={getDefaultConversation()}
      i18n={i18n}
      me={getDefaultConversation()}
      ringMode={RingMode.WillRing}
    />
  );
}

export function Ring0(): React.JSX.Element {
  return (
    <CallingPreCallInfo
      conversation={getDefaultGroupConversation()}
      groupMembers={otherMembers.slice(0, 0)}
      i18n={i18n}
      me={getDefaultConversation()}
      peekedParticipants={[]}
      ringMode={RingMode.WillRing}
    />
  );
}

export function Ring1(): React.JSX.Element {
  return (
    <CallingPreCallInfo
      conversation={getDefaultGroupConversation()}
      groupMembers={otherMembers.slice(0, 1)}
      i18n={i18n}
      me={getDefaultConversation()}
      peekedParticipants={[]}
      ringMode={RingMode.WillRing}
    />
  );
}

export function Ring2(): React.JSX.Element {
  return (
    <CallingPreCallInfo
      conversation={getDefaultGroupConversation()}
      groupMembers={otherMembers.slice(0, 2)}
      i18n={i18n}
      me={getDefaultConversation()}
      peekedParticipants={[]}
      ringMode={RingMode.WillRing}
    />
  );
}

export function Ring3(): React.JSX.Element {
  return (
    <CallingPreCallInfo
      conversation={getDefaultGroupConversation()}
      groupMembers={otherMembers.slice(0, 3)}
      i18n={i18n}
      me={getDefaultConversation()}
      peekedParticipants={[]}
      ringMode={RingMode.WillRing}
    />
  );
}

export function Ring4(): React.JSX.Element {
  return (
    <CallingPreCallInfo
      conversation={getDefaultGroupConversation()}
      groupMembers={otherMembers.slice(0, 4)}
      i18n={i18n}
      me={getDefaultConversation()}
      peekedParticipants={[]}
      ringMode={RingMode.WillRing}
    />
  );
}

export function Notify0(): React.JSX.Element {
  return (
    <CallingPreCallInfo
      conversation={getDefaultGroupConversation()}
      groupMembers={otherMembers.slice(0, 0)}
      i18n={i18n}
      me={getDefaultConversation()}
      peekedParticipants={[]}
      ringMode={RingMode.WillNotRing}
    />
  );
}

export function Notify1(): React.JSX.Element {
  return (
    <CallingPreCallInfo
      conversation={getDefaultGroupConversation()}
      groupMembers={otherMembers.slice(0, 1)}
      i18n={i18n}
      me={getDefaultConversation()}
      peekedParticipants={[]}
      ringMode={RingMode.WillNotRing}
    />
  );
}

export function Notify2(): React.JSX.Element {
  return (
    <CallingPreCallInfo
      conversation={getDefaultGroupConversation()}
      groupMembers={otherMembers.slice(0, 2)}
      i18n={i18n}
      me={getDefaultConversation()}
      peekedParticipants={[]}
      ringMode={RingMode.WillNotRing}
    />
  );
}

export function Notify3(): React.JSX.Element {
  return (
    <CallingPreCallInfo
      conversation={getDefaultGroupConversation()}
      groupMembers={otherMembers.slice(0, 3)}
      i18n={i18n}
      me={getDefaultConversation()}
      peekedParticipants={[]}
      ringMode={RingMode.WillNotRing}
    />
  );
}

export function Notify4(): React.JSX.Element {
  return (
    <CallingPreCallInfo
      conversation={getDefaultGroupConversation()}
      groupMembers={otherMembers.slice(0, 4)}
      i18n={i18n}
      me={getDefaultConversation()}
      peekedParticipants={[]}
      ringMode={RingMode.WillNotRing}
    />
  );
}

export function Peek1(): React.JSX.Element {
  return (
    <CallingPreCallInfo
      conversation={getDefaultGroupConversation()}
      groupMembers={otherMembers}
      i18n={i18n}
      me={getDefaultConversation()}
      peekedParticipants={otherMembers.slice(0, 1)}
      ringMode={RingMode.WillRing}
    />
  );
}

export function Peek2(): React.JSX.Element {
  return (
    <CallingPreCallInfo
      conversation={getDefaultGroupConversation()}
      groupMembers={otherMembers}
      i18n={i18n}
      me={getDefaultConversation()}
      peekedParticipants={otherMembers.slice(0, 2)}
      ringMode={RingMode.WillRing}
    />
  );
}

export function Peek3(): React.JSX.Element {
  return (
    <CallingPreCallInfo
      conversation={getDefaultGroupConversation()}
      groupMembers={otherMembers}
      i18n={i18n}
      me={getDefaultConversation()}
      peekedParticipants={otherMembers.slice(0, 3)}
      ringMode={RingMode.WillRing}
    />
  );
}

export function Peek4(): React.JSX.Element {
  return (
    <CallingPreCallInfo
      conversation={getDefaultGroupConversation()}
      groupMembers={otherMembers}
      i18n={i18n}
      me={getDefaultConversation()}
      peekedParticipants={otherMembers.slice(0, 4)}
      ringMode={RingMode.WillRing}
    />
  );
}

export function GroupConversationYouOnAnOtherDevice(): React.JSX.Element {
  const me = getDefaultConversation();
  return (
    <CallingPreCallInfo
      conversation={getDefaultGroupConversation()}
      groupMembers={otherMembers}
      i18n={i18n}
      me={me}
      peekedParticipants={[me]}
      ringMode={RingMode.WillRing}
    />
  );
}

export function GroupConversationCallIsFull(): React.JSX.Element {
  return (
    <CallingPreCallInfo
      conversation={getDefaultGroupConversation()}
      groupMembers={otherMembers}
      i18n={i18n}
      isCallFull
      me={getDefaultConversation()}
      peekedParticipants={otherMembers}
      ringMode={RingMode.WillRing}
    />
  );
}

export function CallLinkUnknownContact(): React.JSX.Element {
  return (
    <CallingPreCallInfo
      conversation={callLinkToConversation(FAKE_CALL_LINK, i18n)}
      groupMembers={otherMembers}
      i18n={i18n}
      me={getDefaultConversation()}
      peekedParticipants={[getUnknownContact()]}
      ringMode={RingMode.WillNotRing}
    />
  );
}

export function CallLink3UnknownContacts(): React.JSX.Element {
  return (
    <CallingPreCallInfo
      conversation={callLinkToConversation(FAKE_CALL_LINK, i18n)}
      groupMembers={otherMembers}
      i18n={i18n}
      me={getDefaultConversation()}
      peekedParticipants={[
        getUnknownContact(),
        getUnknownContact(),
        getUnknownContact(),
      ]}
      ringMode={RingMode.WillNotRing}
    />
  );
}

export function CallLink1Known1UnknownContact(): React.JSX.Element {
  return (
    <CallingPreCallInfo
      conversation={callLinkToConversation(FAKE_CALL_LINK, i18n)}
      groupMembers={otherMembers}
      i18n={i18n}
      me={getDefaultConversation()}
      peekedParticipants={[otherMembers[0], getUnknownContact()]}
      ringMode={RingMode.WillNotRing}
    />
  );
}

export function CallLink1Known2UnknownContacts(): React.JSX.Element {
  return (
    <CallingPreCallInfo
      conversation={callLinkToConversation(FAKE_CALL_LINK, i18n)}
      groupMembers={otherMembers}
      i18n={i18n}
      me={getDefaultConversation()}
      peekedParticipants={[
        otherMembers[0],
        getUnknownContact(),
        getUnknownContact(),
      ]}
      ringMode={RingMode.WillNotRing}
    />
  );
}
