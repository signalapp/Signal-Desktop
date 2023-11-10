// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import { SafetyNumberModal } from '../../components/SafetyNumberModal';
import type { StateType } from '../reducer';
import { getContactSafetyNumber } from '../selectors/safetyNumber';
import { getConversationSelector } from '../selectors/conversations';
import { getIntl } from '../selectors/user';

export type Props = {
  contactID: string;
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

export const SmartSafetyNumberModal = smart(SafetyNumberModal);
