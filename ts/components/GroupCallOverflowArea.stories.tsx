// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { FC } from 'react';
import React from 'react';
import { memoize, times } from 'lodash';
import { storiesOf } from '@storybook/react';
import { number } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';

import { GroupCallOverflowArea } from './GroupCallOverflowArea';
import { setupI18n } from '../util/setupI18n';
import { getDefaultConversationWithUuid } from '../test-both/helpers/getDefaultConversation';
import { fakeGetGroupCallVideoFrameSource } from '../test-both/helpers/fakeGetGroupCallVideoFrameSource';
import { FRAME_BUFFER_SIZE } from '../calling/constants';
import enMessages from '../../_locales/en/messages.json';

const MAX_PARTICIPANTS = 32;

const i18n = setupI18n('en', enMessages);

const allRemoteParticipants = times(MAX_PARTICIPANTS).map(index => ({
  demuxId: index,
  hasRemoteAudio: index % 3 !== 0,
  hasRemoteVideo: index % 4 !== 0,
  presenting: false,
  sharingScreen: false,
  videoAspectRatio: 1.3,
  ...getDefaultConversationWithUuid({
    isBlocked: index === 10 || index === MAX_PARTICIPANTS - 1,
    title: `Participant ${index + 1}`,
  }),
}));

const story = storiesOf('Components/GroupCallOverflowArea', module);

const defaultProps = {
  getFrameBuffer: memoize(() => Buffer.alloc(FRAME_BUFFER_SIZE)),
  getGroupCallVideoFrameSource: fakeGetGroupCallVideoFrameSource,
  i18n,
  onParticipantVisibilityChanged: action('onParticipantVisibilityChanged'),
};

// This component is usually rendered on a call screen.
const Container: FC = ({ children }) => (
  <div
    style={{
      background: 'black',
      display: 'inline-flex',
      height: '80vh',
    }}
  >
    {children}
  </div>
);

story.add('No overflowed participants', () => (
  <Container>
    <GroupCallOverflowArea {...defaultProps} overflowedParticipants={[]} />
  </Container>
));

story.add('One overflowed participant', () => (
  <Container>
    <GroupCallOverflowArea
      {...defaultProps}
      overflowedParticipants={allRemoteParticipants.slice(0, 1)}
    />
  </Container>
));

story.add('Three overflowed participants', () => (
  <Container>
    <GroupCallOverflowArea
      {...defaultProps}
      overflowedParticipants={allRemoteParticipants.slice(0, 3)}
    />
  </Container>
));

story.add('Many overflowed participants', () => (
  <Container>
    <GroupCallOverflowArea
      {...defaultProps}
      overflowedParticipants={allRemoteParticipants.slice(
        0,
        number('Participant count', MAX_PARTICIPANTS, {
          range: true,
          min: 0,
          max: MAX_PARTICIPANTS,
          step: 1,
        })
      )}
    />
  </Container>
));
