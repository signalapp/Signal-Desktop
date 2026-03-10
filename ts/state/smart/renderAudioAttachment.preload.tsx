// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactElement } from 'react';
import React from 'react';
import { VoiceNotesPlaybackContext } from '../../components/VoiceNotesPlaybackContext.dom.js';
import type { Props as MessageAudioProps } from './MessageAudio.preload.js';
import { SmartMessageAudio } from './MessageAudio.preload.js';

export type RenderAudioAttachmentProps = Omit<
  MessageAudioProps,
  'computePeaks'
>;

export function renderAudioAttachment(
  props: RenderAudioAttachmentProps
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
