// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { connect } from 'react-redux';
import { pick } from 'lodash';

import { MessageAudio } from '../../components/conversation/MessageAudio';
import type { OwnProps as MessageAudioOwnProps } from '../../components/conversation/MessageAudio';

import { mapDispatchToProps } from '../actions';
import type { StateType } from '../reducer';
import type { ActiveAudioPlayerStateType } from '../ducks/audioPlayer';

export type Props = Omit<MessageAudioOwnProps, 'active'>;

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
