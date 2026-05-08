// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';

import lodash from 'lodash';
import { action } from '@storybook/addon-actions';

import type { Meta } from '@storybook/react';
import type { PropsType } from './CallingAdhocCallInfo.dom.tsx';
import { CallingAdhocCallInfo } from './CallingAdhocCallInfo.dom.tsx';
import { AvatarColors } from '../types/Colors.std.ts';
import type { GroupCallRemoteParticipantType } from '../types/Calling.std.ts';
import { getDefaultConversation } from '../test-helpers/getDefaultConversation.std.ts';
import type { CallLinkType } from '../types/CallLink.std.ts';
import { CallLinkRestrictions } from '../types/CallLink.std.ts';
import { generateAci } from '../test-helpers/serviceIdUtils.std.ts';
import { renderCallingParticipantMenu } from './CallingParticipantMenu.dom.stories.tsx';

const { sample } = lodash;

const { i18n } = window.SignalContext;

const OUR_ACI = generateAci();

function createParticipant(
  participantProps: Partial<GroupCallRemoteParticipantType>,
  isUnknownContact?: boolean
): GroupCallRemoteParticipantType {
  const aci = participantProps.aci ?? generateAci();

  return {
    aci,
    demuxId: 2,
    hasRemoteAudio: Boolean(participantProps.hasRemoteAudio),
    hasRemoteVideo: Boolean(participantProps.hasRemoteVideo),
    isOnlyHandRaised: Boolean(participantProps.isOnlyHandRaised),
    mediaKeysReceived: Boolean(participantProps.mediaKeysReceived),
    presenting: Boolean(participantProps.presenting),
    raisedHandOrder: participantProps.raisedHandOrder,
    sharingScreen: Boolean(participantProps.sharingScreen),
    videoAspectRatio: 1.3,
    ...getDefaultConversation({
      avatarUrl: participantProps.avatarUrl,
      color: sample(AvatarColors),
      isBlocked: Boolean(participantProps.isBlocked),
      name: participantProps.name,
      profileName: participantProps.title,
      title: String(participantProps.title),
      serviceId: aci,
      ...(isUnknownContact && { titleNoDefault: undefined }),
    }),
    isMe: Boolean(participantProps.isMe),
  };
}

function getCallLink(overrideProps: Partial<CallLinkType> = {}): CallLinkType {
  // Normally, roomId would be derived from rootKey however we don't want to import
  // ringrtc in storybook
  return {
    roomId: 'abcd1234abcd1234abcd1234abcd1234abcd1234',
    rootKey: 'abcd-abcd-abcd-abcd-abcd-abcd-abcd-abcd',
    adminKey: null,
    name: 'Axolotl Discuss',
    restrictions: CallLinkRestrictions.None,
    revoked: false,
    expiration: Date.now() + 30 * 24 * 60 * 60 * 1000,
    storageNeedsSync: false,
    ...overrideProps,
  };
}

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  callLink: getCallLink(overrideProps.callLink || {}),
  i18n,
  isUnknownContactDiscrete: overrideProps.isUnknownContactDiscrete || false,
  ourServiceId: OUR_ACI,
  participants: overrideProps.participants || [],
  onClose: action('on-close'),
  onCopyCallLink: action('on-copy-call-link'),
  onShareCallLinkViaSignal: action('on-share-call-link-via-signal'),
  showContactModal: action('show-contact-modal'),
  renderCallingParticipantMenu,
});

export default {
  title: 'Components/CallingAdhocCallInfo',
} satisfies Meta<PropsType>;

export function NoOne(): JSX.Element {
  const props = createProps();
  return <CallingAdhocCallInfo {...props} />;
}

export function SoloCall(): JSX.Element {
  const props = createProps({
    participants: [
      createParticipant({
        title: 'Bardock',
      }),
    ],
  });
  return <CallingAdhocCallInfo {...props} />;
}

export function ManyParticipants(): JSX.Element {
  const props = createProps({
    participants: [
      createParticipant({
        title: 'Son Goku',
      }),
      createParticipant({
        hasRemoteAudio: true,
        hasRemoteVideo: true,
        presenting: true,
        name: 'Rage Trunks',
        title: 'Rage Trunks',
      }),
      createParticipant({
        hasRemoteAudio: true,
        title: 'Prince Vegeta',
      }),
      createParticipant({
        hasRemoteAudio: true,
        hasRemoteVideo: true,
        name: 'Goku Black',
        title: 'Goku Black',
      }),
      createParticipant({
        raisedHandOrder: 0,
        title: 'Supreme Kai Zamasu',
      }),
      createParticipant({
        hasRemoteAudio: false,
        hasRemoteVideo: true,
        raisedHandOrder: 1,
        title: 'Chi Chi',
      }),
      createParticipant({
        title: 'Someone With A Really Long Name',
      }),
      createParticipant({
        title: 'My Name',
        aci: OUR_ACI,
        isMe: true,
      }),
    ],
  });
  return <CallingAdhocCallInfo {...props} />;
}

export function Overflow(): JSX.Element {
  const props = createProps({
    participants: Array(50)
      .fill(null)
      .map(() => createParticipant({ title: 'Kirby' })),
  });
  return <CallingAdhocCallInfo {...props} />;
}

export function AsAdmin(): JSX.Element {
  const props = createProps({
    participants: [
      createParticipant({
        title: 'Son Goku',
      }),
      createParticipant({
        hasRemoteAudio: true,
        hasRemoteVideo: true,
        presenting: true,
        name: 'Rage Trunks',
        title: 'Rage Trunks',
      }),
      createParticipant({
        hasRemoteAudio: true,
        title: 'Prince Vegeta',
      }),
      createParticipant({
        hasRemoteAudio: true,
        hasRemoteVideo: true,
        name: 'Goku',
        title: 'Goku',
      }),
      createParticipant({
        title: 'Someone With A Really Long Name',
      }),
      createParticipant({
        title: 'My Name',
        aci: OUR_ACI,
      }),
    ],
  });
  return <CallingAdhocCallInfo {...props} />;
}

export function UnknownParticipants(): JSX.Element {
  const props = createProps({
    participants: [
      createParticipant({ title: 'Son Goku' }),
      createParticipant({ title: 'Unknown Contact' }, true),
      createParticipant({ title: 'Unknown Contact' }, true),
    ],
  });
  return <CallingAdhocCallInfo {...props} />;
}
