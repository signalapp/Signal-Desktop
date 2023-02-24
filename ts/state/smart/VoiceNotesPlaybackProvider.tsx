// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import { VoiceNotesPlaybackProvider } from '../../components/VoiceNotesPlaybackContext';
import type { StateType } from '../reducer';
import { getSelectedConversationId } from '../selectors/conversations';
import { isPaused } from '../selectors/audioPlayer';

const mapStateToProps = (state: StateType) => {
  return {
    conversationId: getSelectedConversationId(state),
    isPaused: isPaused(state),
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartVoiceNotesPlaybackProvider = smart(
  VoiceNotesPlaybackProvider
);
