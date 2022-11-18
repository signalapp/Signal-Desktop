// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { times } from 'lodash';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';
import { getDefaultConversation } from '../test-both/helpers/getDefaultConversation';

import { CallingPreCallInfo, RingMode } from './CallingPreCallInfo';

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

export default {
  title: 'Components/CallingPreCallInfo',
};

export function DirectConversation(): JSX.Element {
  return (
    <CallingPreCallInfo
      conversation={getDefaultConversation()}
      i18n={i18n}
      me={getDefaultConversation()}
      ringMode={RingMode.WillRing}
    />
  );
}

DirectConversation.story = {
  name: 'Direct conversation',
};

export function Ring0(): JSX.Element {
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

Ring0.story = {
  name: 'Group call: Will ring 0 people',
};

export function Ring1(): JSX.Element {
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

Ring1.story = {
  name: 'Group call: Will ring 1 person',
};

export function Ring2(): JSX.Element {
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

Ring2.story = {
  name: 'Group call: Will ring 2 people',
};

export function Ring3(): JSX.Element {
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

Ring3.story = {
  name: 'Group call: Will ring 3 people',
};

export function Ring4(): JSX.Element {
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

Ring3.story = {
  name: 'Group call: Will ring 4 people',
};

export function Notify0(): JSX.Element {
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

Notify0.story = {
  name: 'Group call: Will notify 0 people',
};

export function Notify1(): JSX.Element {
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

Notify1.story = {
  name: 'Group call: Will notify 1 person',
};

export function Notify2(): JSX.Element {
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

Notify2.story = {
  name: 'Group call: Will notify 2 people',
};

export function Notify3(): JSX.Element {
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

Notify3.story = {
  name: 'Group call: Will notify 3 people',
};

export function Notify4(): JSX.Element {
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

Notify4.story = {
  name: 'Group call: Will notify 4 people',
};

export function Peek1(): JSX.Element {
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

Peek1.story = {
  name: 'Group call: 1 participant peeked',
};

export function Peek2(): JSX.Element {
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

Peek2.story = {
  name: 'Group call: 2 participants peeked',
};

export function Peek3(): JSX.Element {
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

Peek3.story = {
  name: 'Group call: 3 participants peeked',
};

export function Peek4(): JSX.Element {
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

Peek4.story = {
  name: 'Group call: 4 participants peeked',
};

export function GroupConversationYouOnAnOtherDevice(): JSX.Element {
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

GroupConversationYouOnAnOtherDevice.story = {
  name: 'Group conversation, you on an other device',
};

export function GroupConversationCallIsFull(): JSX.Element {
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

GroupConversationCallIsFull.story = {
  name: 'Group conversation, call is full',
};
