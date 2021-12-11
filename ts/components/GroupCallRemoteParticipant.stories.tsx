// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { memoize, noop } from 'lodash';
import { storiesOf } from '@storybook/react';

import type { PropsType } from './GroupCallRemoteParticipant';
import { GroupCallRemoteParticipant } from './GroupCallRemoteParticipant';
import { getDefaultConversation } from '../test-both/helpers/getDefaultConversation';
import { FRAME_BUFFER_SIZE } from '../calling/constants';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

type OverridePropsType =
  | {
      isInPip: true;
    }
  | {
      isInPip: false;
      height: number;
      left: number;
      top: number;
      width: number;
    };

const getFrameBuffer = memoize(() => Buffer.alloc(FRAME_BUFFER_SIZE));

const createProps = (
  overrideProps: OverridePropsType,
  isBlocked?: boolean
): PropsType => ({
  getFrameBuffer,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getGroupCallVideoFrameSource: noop as any,
  i18n,
  remoteParticipant: {
    demuxId: 123,
    hasRemoteAudio: false,
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

const story = storiesOf('Components/GroupCallRemoteParticipant', module);

story.add('Default', () => (
  <GroupCallRemoteParticipant
    {...createProps({
      isInPip: false,
      height: 120,
      left: 0,
      top: 0,
      width: 120,
    })}
  />
));

story.add('isInPip', () => (
  <GroupCallRemoteParticipant
    {...createProps({
      isInPip: true,
    })}
  />
));

story.add('Blocked', () => (
  <GroupCallRemoteParticipant
    {...createProps(
      {
        isInPip: false,
        height: 120,
        left: 0,
        top: 0,
        width: 120,
      },
      true
    )}
  />
));
