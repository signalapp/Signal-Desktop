// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactElement } from 'react';
import React from 'react';
import { GlobalAudioContext } from '../../components/GlobalAudioContext';
import type { Props as MessageAudioProps } from './MessageAudio';
import { SmartMessageAudio } from './MessageAudio';

type AudioAttachmentProps = Omit<MessageAudioProps, 'audio' | 'computePeaks'>;

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
