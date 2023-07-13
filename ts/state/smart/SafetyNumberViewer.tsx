// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import { SafetyNumberViewer } from '../../components/SafetyNumberViewer';
import type { StateType } from '../reducer';
import type { SafetyNumberProps } from '../../components/SafetyNumberChangeDialog';
import { getContactSafetyNumber } from '../selectors/safetyNumber';
import { getConversationSelector } from '../selectors/conversations';
import { getSafetyNumberMode } from '../selectors/items';
import { getIntl } from '../selectors/user';

const mapStateToProps = (state: StateType, props: SafetyNumberProps) => {
  return {
    ...props,
    ...getContactSafetyNumber(state, props),
    contact: getConversationSelector(state)(props.contactID),
    safetyNumberMode: getSafetyNumberMode(state, { now: Date.now() }),
    i18n: getIntl(state),
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartSafetyNumberViewer = smart(SafetyNumberViewer);
