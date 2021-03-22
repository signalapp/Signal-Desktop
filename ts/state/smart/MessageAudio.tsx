// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { connect } from 'react-redux';

import { MessageAudio } from '../../components/conversation/MessageAudio';

import { mapDispatchToProps } from '../actions';
import { StateType } from '../reducer';
import { WaveformCache } from '../../types/Audio';
import { LocalizerType } from '../../types/Util';
import { AttachmentType } from '../../types/Attachment';

export type Props = {
  audio: HTMLAudioElement;
  audioContext: AudioContext;
  waveformCache: WaveformCache;

  direction?: 'incoming' | 'outgoing';
  id: string;
  i18n: LocalizerType;
  attachment: AttachmentType;
  withContentAbove: boolean;
  withContentBelow: boolean;

  buttonRef: React.RefObject<HTMLButtonElement>;
  kickOffAttachmentDownload(): void;
  onCorrupted(): void;
};

const mapStateToProps = (state: StateType, props: Props) => {
  return {
    ...props,
    ...state.audioPlayer,
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);
export const SmartMessageAudio = smart(MessageAudio);
