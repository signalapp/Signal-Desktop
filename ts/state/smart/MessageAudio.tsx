// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { connect } from 'react-redux';

import { MessageAudio } from '../../components/conversation/MessageAudio';
import type { ComputePeaksResult } from '../../components/GlobalAudioContext';

import { mapDispatchToProps } from '../actions';
import type { StateType } from '../reducer';
import type { LocalizerType } from '../../types/Util';
import type { AttachmentType } from '../../types/Attachment';
import type {
  DirectionType,
  MessageStatusType,
} from '../../components/conversation/Message';

export type Props = {
  audio: HTMLAudioElement;

  renderingContext: string;
  i18n: LocalizerType;
  attachment: AttachmentType;
  collapseMetadata: boolean;
  withContentAbove: boolean;
  withContentBelow: boolean;

  direction: DirectionType;
  expirationLength?: number;
  expirationTimestamp?: number;
  id: string;
  played: boolean;
  showMessageDetail: (id: string) => void;
  status?: MessageStatusType;
  textPending?: boolean;
  timestamp: number;

  buttonRef: React.RefObject<HTMLButtonElement>;

  computePeaks(url: string, barCount: number): Promise<ComputePeaksResult>;
  kickOffAttachmentDownload(): void;
  onCorrupted(): void;
  onFirstPlayed(): void;
};

const mapStateToProps = (state: StateType, props: Props) => {
  return {
    ...props,
    ...state.audioPlayer,
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);
export const SmartMessageAudio = smart(MessageAudio);
