// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isNumber } from 'lodash';
import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';

import type { STATE_ENUM } from '../../components/conversation/TimelineLoadingRow';
import { TimelineLoadingRow } from '../../components/conversation/TimelineLoadingRow';
import { LOAD_COUNTDOWN } from '../../components/conversation/Timeline';

import type { StateType } from '../reducer';
import { getIntl } from '../selectors/user';
import { getConversationMessagesSelector } from '../selectors/conversations';

type ExternalProps = {
  id: string;
};

const mapStateToProps = (state: StateType, props: ExternalProps) => {
  const { id } = props;

  const conversation = getConversationMessagesSelector(state)(id);
  if (!conversation) {
    throw new Error(`Did not find conversation ${id} in state!`);
  }

  const { isLoadingMessages, loadCountdownStart } = conversation;

  let loadingState: STATE_ENUM;

  if (isLoadingMessages) {
    loadingState = 'loading';
  } else if (isNumber(loadCountdownStart)) {
    loadingState = 'countdown';
  } else {
    loadingState = 'idle';
  }

  const duration = loadingState === 'countdown' ? LOAD_COUNTDOWN : undefined;
  const expiresAt =
    loadingState === 'countdown' && loadCountdownStart
      ? loadCountdownStart + LOAD_COUNTDOWN
      : undefined;

  return {
    state: loadingState,
    duration,
    expiresAt,
    i18n: getIntl(state),
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartTimelineLoadingRow = smart(TimelineLoadingRow);
