// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createRef, useState, useEffect, type JSX } from 'react';
import lodash from 'lodash';
import type { Meta } from '@storybook/react';
import type { PropsType } from './GroupCallRemoteParticipant.dom.tsx';
import { GroupCallRemoteParticipant } from './GroupCallRemoteParticipant.dom.tsx';
import { getDefaultConversation } from '../test-helpers/getDefaultConversation.std.ts';
import { FRAME_BUFFER_SIZE } from '../calling/constants.std.ts';
import type { CallingImageDataCache } from './CallManager.dom.tsx';
import { MINUTE } from '../util/durations/index.std.ts';
import { generateAci } from '../test-helpers/serviceIdUtils.std.ts';

const { memoize } = lodash;

const { i18n } = window.SignalContext;

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

const getFrameBuffer = memoize(() => new Uint8Array(FRAME_BUFFER_SIZE));

const createProps = (
  overrideProps: OverridePropsType,
  {
    addedTime,
    isBlocked = false,
    isOnlyHandRaised = false,
    hasRemoteAudio = false,
    mediaKeysReceived = true,
    presenting = false,
    raisedHandOrder,
  }: {
    addedTime?: number;
    isBlocked?: boolean;
    isOnlyHandRaised?: boolean;
    hasRemoteAudio?: boolean;
    mediaKeysReceived?: boolean;
    presenting?: boolean;
    raisedHandOrder?: number | undefined;
  } = {}
): PropsType => ({
  getFrameBuffer,
  getGroupCallVideoFrameSource: () => {
    return { receiveVideoFrame: () => undefined };
  },
  imageDataCache: createRef<CallingImageDataCache | null>(),
  i18n,
  audioLevel: 0,
  remoteParticipant: {
    aci: generateAci(),
    addedTime,
    demuxId: 123,
    hasRemoteAudio,
    hasRemoteVideo: true,
    isOnlyHandRaised,
    mediaKeysReceived,
    presenting,
    raisedHandOrder,
    sharingScreen: false,
    videoAspectRatio: 1.3,
    ...getDefaultConversation({
      isBlocked,
      title:
        'Pablo Diego José Francisco de Paula Juan Nepomuceno María de los Remedios Cipriano de la Santísima Trinidad Ruiz y Picasso',
      serviceId: generateAci(),
    }),
  },
  remoteParticipantsCount: 1,
  isActiveSpeakerInSpeakerView: false,
  isCallReconnecting: false,
  joinedAt: new Date().getTime() - MINUTE,
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

export function HandRaisedOnlyOne(): JSX.Element {
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
        {
          isOnlyHandRaised: true,
          raisedHandOrder: 0,
        }
      )}
    />
  );
}

export function HandRaisedFirstOfMany(): JSX.Element {
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
        {
          isOnlyHandRaised: false,
          raisedHandOrder: 0,
        }
      )}
    />
  );
}

export function HandRaisedSecondOfMany(): JSX.Element {
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
        {
          isOnlyHandRaised: false,
          raisedHandOrder: 1,
        }
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

export function NoMediaKeys(): JSX.Element {
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
        {
          addedTime: Date.now() - MINUTE,
          hasRemoteAudio: true,
          mediaKeysReceived: false,
        }
      )}
    />
  );
}

export function NoMediaKeysBlockedIntermittent(): JSX.Element {
  const [isBlocked, setIsBlocked] = useState(false);
  useEffect(() => {
    const interval = setInterval(() => {
      setIsBlocked(value => !value);
    }, 6000);

    return () => clearInterval(interval);
  }, [isBlocked]);

  const [mediaKeysReceived, setMediaKeysReceived] = useState(false);
  useEffect(() => {
    const interval = setInterval(() => {
      setMediaKeysReceived(value => !value);
    }, 3000);

    return () => clearInterval(interval);
  }, [mediaKeysReceived]);

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
        {
          addedTime: Date.now() - 60 * 1000,
          hasRemoteAudio: true,
          mediaKeysReceived,
          isBlocked,
        }
      )}
    />
  );
}
