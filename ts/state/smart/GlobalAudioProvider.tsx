// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import { GlobalAudioProvider } from '../../components/GlobalAudioContext';
import type { StateType } from '../reducer';
import { isPaused } from '../selectors/audioPlayer';
import { getSelectedConversationId } from '../selectors/conversations';

const mapStateToProps = (state: StateType) => {
  return {
    conversationId: getSelectedConversationId(state),
    isPaused: isPaused(state),
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartGlobalAudioProvider = smart(GlobalAudioProvider);
