// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import lodash from 'lodash';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { PropsType } from './GroupCallOverflowArea.dom.js';
import { GroupCallOverflowArea } from './GroupCallOverflowArea.dom.js';
import { getDefaultConversationWithServiceId } from '../test-helpers/getDefaultConversation.std.js';
import { fakeGetGroupCallVideoFrameSource } from '../test-helpers/fakeGetGroupCallVideoFrameSource.std.js';
import { FRAME_BUFFER_SIZE } from '../calling/constants.std.js';
import { generateAci } from '../types/ServiceId.std.js';
import type { CallingImageDataCache } from './CallManager.dom.js';
import { MINUTE } from '../util/durations/index.std.js';

const { memoize, times } = lodash;

const MAX_PARTICIPANTS = 32;

const { i18n } = window.SignalContext;

const allRemoteParticipants = times(MAX_PARTICIPANTS).map(index => ({
  aci: generateAci(),
  demuxId: index,
  hasRemoteAudio: index % 3 !== 0,
  hasRemoteVideo: index % 4 !== 0,
  isHandRaised: (index - 2) % 8 === 0,
  mediaKeysReceived: (index + 1) % 20 !== 0,
  presenting: false,
  sharingScreen: false,
  videoAspectRatio: 1.3,
  ...getDefaultConversationWithServiceId({
    isBlocked: index === 10 || index === MAX_PARTICIPANTS - 1,
    title: `Participant ${index + 1}`,
  }),
}));

export default {
  title: 'Components/GroupCallOverflowArea',
  argTypes: {},
  args: {},
} satisfies Meta<PropsType>;

const defaultProps = {
  getFrameBuffer: memoize(() => new Uint8Array(FRAME_BUFFER_SIZE)),
  getCallingImageDataCache: memoize(() => new Map()),
  getGroupCallVideoFrameSource: fakeGetGroupCallVideoFrameSource,
  imageDataCache: React.createRef<CallingImageDataCache>(),
  i18n,
  isCallReconnecting: false,
  joinedAt: new Date().getTime() - MINUTE,
  onParticipantVisibilityChanged: action('onParticipantVisibilityChanged'),
  remoteAudioLevels: new Map<number, number>(),
  remoteParticipantsCount: 1,
};

// This component is usually rendered on a call screen.
function Container({ children }: { children: JSX.Element }): JSX.Element {
  return (
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
}

export function NoOverflowedParticipants(): JSX.Element {
  return (
    <Container>
      <GroupCallOverflowArea {...defaultProps} overflowedParticipants={[]} />
    </Container>
  );
}

export function OneOverflowedParticipant(): JSX.Element {
  return (
    <Container>
      <GroupCallOverflowArea
        {...defaultProps}
        overflowedParticipants={allRemoteParticipants.slice(0, 1)}
      />
    </Container>
  );
}

export function ThreeOverflowedParticipants(): JSX.Element {
  return (
    <Container>
      <GroupCallOverflowArea
        {...defaultProps}
        overflowedParticipants={allRemoteParticipants.slice(0, 3)}
      />
    </Container>
  );
}

export function ManyOverflowedParticipants(): JSX.Element {
  return (
    <Container>
      <GroupCallOverflowArea
        {...defaultProps}
        overflowedParticipants={allRemoteParticipants.slice(
          0,
          MAX_PARTICIPANTS
        )}
      />
    </Container>
  );
}
