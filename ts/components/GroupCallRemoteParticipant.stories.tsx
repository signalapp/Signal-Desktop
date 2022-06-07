// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { memoize, noop } from 'lodash';
import { select } from '@storybook/addon-knobs';

import type { PropsType } from './GroupCallRemoteParticipant';
import { GroupCallRemoteParticipant } from './GroupCallRemoteParticipant';
import { getDefaultConversation } from '../test-both/helpers/getDefaultConversation';
import { FRAME_BUFFER_SIZE } from '../calling/constants';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

type OverridePropsType = {
  audioLevel?: number;
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
  }: {
    isBlocked?: boolean;
    hasRemoteAudio?: boolean;
  } = {}
): PropsType => ({
  getFrameBuffer,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getGroupCallVideoFrameSource: noop as any,
  i18n,
  audioLevel: 0,
  remoteParticipant: {
    demuxId: 123,
    hasRemoteAudio,
    hasRemoteVideo: true,
    presenting: false,
    sharingScreen: false,
    videoAspectRatio: 1.3,
    ...getDefaultConversation({
      isBlocked: Boolean(isBlocked),
      title:
        'Pablo Diego José Francisco de Paula Juan Nepomuceno María de los Remedios Cipriano de la Santísima Trinidad Ruiz y Picasso',
      uuid: '992ed3b9-fc9b-47a9-bdb4-e0c7cbb0fda5',
    }),
  },
  ...overrideProps,
});

export default {
  title: 'Components/GroupCallRemoteParticipant',
};

export const Default = (): JSX.Element => (
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

export const Speaking = (): JSX.Element => (
  <GroupCallRemoteParticipant
    {...createProps(
      {
        isInPip: false,
        height: 120,
        left: 0,
        top: 0,
        width: 120,
        audioLevel: select('audioLevel', [0, 0.5, 1], 0.5),
      },
      { hasRemoteAudio: true }
    )}
  />
);

export const IsInPip = (): JSX.Element => (
  <GroupCallRemoteParticipant
    {...createProps({
      isInPip: true,
    })}
  />
);

IsInPip.story = {
  name: 'isInPip',
};

export const Blocked = (): JSX.Element => (
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
