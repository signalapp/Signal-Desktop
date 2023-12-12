// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { memoize } from 'lodash';
import type { Meta } from '@storybook/react';
import type { PropsType } from './GroupCallRemoteParticipant';
import { GroupCallRemoteParticipant } from './GroupCallRemoteParticipant';
import { getDefaultConversation } from '../test-both/helpers/getDefaultConversation';
import { FRAME_BUFFER_SIZE } from '../calling/constants';
import { setupI18n } from '../util/setupI18n';
import { generateAci } from '../types/ServiceId';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

type OverridePropsType = {
  audioLevel?: number;
  remoteParticipantsCount?: number;
} & (
  | {
      isInPip: true;
    }
  | {
      isInPip: false;
      height: number;
      left: number;
      top: number;
      width: number;
    }
);

const getFrameBuffer = memoize(() => Buffer.alloc(FRAME_BUFFER_SIZE));

const createProps = (
  overrideProps: OverridePropsType,
  {
    isBlocked = false,
    hasRemoteAudio = false,
    presenting = false,
    isHandRaised = false,
  }: {
    isBlocked?: boolean;
    hasRemoteAudio?: boolean;
    presenting?: boolean;
    isHandRaised?: boolean;
  } = {}
): PropsType => ({
  getFrameBuffer,
  getGroupCallVideoFrameSource: () => {
    return { receiveVideoFrame: () => undefined };
  },
  i18n,
  audioLevel: 0,
  remoteParticipant: {
    aci: generateAci(),
    demuxId: 123,
    hasRemoteAudio,
    hasRemoteVideo: true,
    isHandRaised,
    presenting,
    sharingScreen: false,
    videoAspectRatio: 1.3,
    ...getDefaultConversation({
      isBlocked: Boolean(isBlocked),
      title:
        'Pablo Diego José Francisco de Paula Juan Nepomuceno María de los Remedios Cipriano de la Santísima Trinidad Ruiz y Picasso',
      serviceId: generateAci(),
    }),
  },
  remoteParticipantsCount: 1,
  isActiveSpeakerInSpeakerView: false,
  isCallReconnecting: false,
  ...overrideProps,
});

export default {
  title: 'Components/GroupCallRemoteParticipant',
  argTypes: {},
  args: {},
} satisfies Meta<PropsType>;

export function Default(): JSX.Element {
  return (
    <GroupCallRemoteParticipant
      {...createProps({
        isInPip: false,
        height: 120,
        left: 0,
        top: 0,
        width: 120,
      })}
    />
  );
}

export function Speaking(): JSX.Element {
  function createSpeakingProps(
    index: number,
    remoteParticipantsCount: number,
    presenting: boolean
  ) {
    return createProps(
      {
        isInPip: false,
        height: 120,
        left: (120 + 10) * index,
        top: 0,
        width: 120,
        audioLevel: 0.5,
        remoteParticipantsCount,
      },
      { hasRemoteAudio: true, presenting }
    );
  }
  return (
    <>
      <GroupCallRemoteParticipant {...createSpeakingProps(0, 1, false)} />
      <GroupCallRemoteParticipant {...createSpeakingProps(1, 2, false)} />
      <GroupCallRemoteParticipant {...createSpeakingProps(2, 2, true)} />
    </>
  );
}

export function HandRaised(): JSX.Element {
  return (
    <GroupCallRemoteParticipant
      {...createProps(
        {
          isInPip: false,
          height: 120,
          left: 0,
          top: 0,
          width: 120,
        },
        { isHandRaised: true }
      )}
    />
  );
}

export function IsInPip(): JSX.Element {
  return (
    <GroupCallRemoteParticipant
      {...createProps({
        isInPip: true,
      })}
    />
  );
}

export function Blocked(): JSX.Element {
  return (
    <GroupCallRemoteParticipant
      {...createProps(
        {
          isInPip: false,
          height: 120,
          left: 0,
          top: 0,
          width: 120,
        },
        { isBlocked: true }
      )}
    />
  );
}
