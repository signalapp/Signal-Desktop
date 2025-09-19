// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactElement } from 'react';
import React from 'react';
import { VoiceNotesPlaybackContext } from '../../components/VoiceNotesPlaybackContext.js';
import type { Props as MessageAudioProps } from './MessageAudio.js';
import { SmartMessageAudio } from './MessageAudio.js';

type AudioAttachmentProps = Omit<MessageAudioProps, 'computePeaks'>;

export function renderAudioAttachment(
  props: AudioAttachmentProps
): ReactElement {
  return (
    <VoiceNotesPlaybackContext.Consumer>
      {voiceNotesPlaybackProps => {
        return (
          voiceNotesPlaybackProps && (
            <SmartMessageAudio {...props} {...voiceNotesPlaybackProps} />
          )
        );
      }}
    </VoiceNotesPlaybackContext.Consumer>
  );
}
