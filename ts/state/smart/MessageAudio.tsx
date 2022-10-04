// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { connect } from 'react-redux';
import { pick } from 'underscore';

import { MessageAudio } from '../../components/conversation/MessageAudio';
import type { OwnProps as MessageAudioOwnProps } from '../../components/conversation/MessageAudio';
import type { ComputePeaksResult } from '../../components/GlobalAudioContext';

import { mapDispatchToProps } from '../actions';
import type { StateType } from '../reducer';
import type { LocalizerType } from '../../types/Util';
import type { AttachmentType } from '../../types/Attachment';
import type {
  DirectionType,
  MessageStatusType,
} from '../../components/conversation/Message';
import type { ActiveAudioPlayerStateType } from '../ducks/audioPlayer';

export type Props = {
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
  conversationId: string;
  played: boolean;
  showMessageDetail: (id: string) => void;
  status?: MessageStatusType;
  textPending?: boolean;
  timestamp: number;

  computePeaks(url: string, barCount: number): Promise<ComputePeaksResult>;
  kickOffAttachmentDownload(): void;
  onCorrupted(): void;
};

const mapStateToProps = (
  state: StateType,
  props: Props
): MessageAudioOwnProps => {
  const { active } = state.audioPlayer;

  const messageActive: ActiveAudioPlayerStateType | undefined =
    active &&
    active.id === props.id &&
    active.context === props.renderingContext
      ? pick(active, 'playing', 'playbackRate', 'currentTime', 'duration')
      : undefined;
  return {
    ...props,
    active: messageActive,
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);
export const SmartMessageAudio = smart(MessageAudio);
