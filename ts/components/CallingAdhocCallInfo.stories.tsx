// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { sample } from 'lodash';
import { action } from '@storybook/addon-actions';

import type { Meta } from '@storybook/react';
import type { PropsType } from './CallingAdhocCallInfo';
import { CallingAdhocCallInfo } from './CallingAdhocCallInfo';
import { AvatarColors } from '../types/Colors';
import type { GroupCallRemoteParticipantType } from '../types/Calling';
import { generateAci } from '../types/ServiceId';
import { getDefaultConversation } from '../test-both/helpers/getDefaultConversation';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';
import type { CallLinkType } from '../types/CallLink';
import { CallLinkRestrictions } from '../types/CallLink';

const i18n = setupI18n('en', enMessages);

const OUR_ACI = generateAci();

function createParticipant(
  participantProps: Partial<GroupCallRemoteParticipantType>
): GroupCallRemoteParticipantType {
  const aci = participantProps.aci ?? generateAci();

  return {
    aci,
    demuxId: 2,
    hasRemoteAudio: Boolean(participantProps.hasRemoteAudio),
    hasRemoteVideo: Boolean(participantProps.hasRemoteVideo),
    isHandRaised: Boolean(participantProps.isHandRaised),
    mediaKeysReceived: Boolean(participantProps.mediaKeysReceived),
    presenting: Boolean(participantProps.presenting),
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
    }),
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
  isCallLinkAdmin: overrideProps.isCallLinkAdmin || false,
  isUnknownContactDiscrete: overrideProps.isUnknownContactDiscrete || false,
  ourServiceId: OUR_ACI,
  participants: overrideProps.participants || [],
  onClose: action('on-close'),
  onCopyCallLink: action('on-copy-call-link'),
  onShareCallLinkViaSignal: action('on-share-call-link-via-signal'),
  removeClient: overrideProps.removeClient || action('remove-client'),
  blockClient: overrideProps.blockClient || action('block-client'),
  showContactModal: action('show-contact-modal'),
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
        isHandRaised: true,
        title: 'Supreme Kai Zamasu',
      }),
      createParticipant({
        hasRemoteAudio: false,
        hasRemoteVideo: true,
        isHandRaised: true,
        title: 'Chi Chi',
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
    isCallLinkAdmin: true,
  });
  return <CallingAdhocCallInfo {...props} />;
}
