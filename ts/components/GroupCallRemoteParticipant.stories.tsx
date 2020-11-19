// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { noop } from 'lodash';
import { storiesOf } from '@storybook/react';

import {
  GroupCallRemoteParticipant,
  PropsType,
} from './GroupCallRemoteParticipant';
import { setup as setupI18n } from '../../js/modules/i18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createProps = (overrideProps: Partial<PropsType> = {}): any => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getGroupCallVideoFrameSource: noop as any,
  i18n,
  remoteParticipant: {
    demuxId: 123,
    hasRemoteAudio: false,
    hasRemoteVideo: true,
    isSelf: false,
    title:
      'Pablo Diego José Francisco de Paula Juan Nepomuceno María de los Remedios Cipriano de la Santísima Trinidad Ruiz y Picasso',
    videoAspectRatio: 1.3,
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
