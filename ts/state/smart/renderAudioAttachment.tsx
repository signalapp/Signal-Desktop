// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { ReactElement } from 'react';
import { GlobalAudioContext } from '../../components/GlobalAudioContext';
import { SmartMessageAudio, Props as MessageAudioProps } from './MessageAudio';

type AudioAttachmentProps = Omit<
  MessageAudioProps,
  'audio' | 'audioContext' | 'waveformCache'
>;

export function renderAudioAttachment(
  props: AudioAttachmentProps
): ReactElement {
  return (
    <GlobalAudioContext.Consumer>
      {globalAudioProps => {
        return (
          globalAudioProps && (
            <SmartMessageAudio {...props} {...globalAudioProps} />
          )
        );
      }}
    </GlobalAudioContext.Consumer>
  );
}
