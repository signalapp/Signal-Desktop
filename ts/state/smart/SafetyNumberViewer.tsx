// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import { SafetyNumberViewer } from '../../components/SafetyNumberViewer';
import type { StateType } from '../reducer';
import { getContactSafetyNumber } from '../selectors/safetyNumber';
import { getConversationSelector } from '../selectors/conversations';
import { getIntl } from '../selectors/user';

export type Props = {
  contactID: string;
  onClose?: () => void;
};

const mapStateToProps = (state: StateType, props: Props) => {
  return {
    ...props,
    ...getContactSafetyNumber(state, props),
    contact: getConversationSelector(state)(props.contactID),
    i18n: getIntl(state),
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartSafetyNumberViewer = smart(SafetyNumberViewer);
