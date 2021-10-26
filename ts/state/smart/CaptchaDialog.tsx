// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import { CaptchaDialog } from '../../components/CaptchaDialog';
import type { StateType } from '../reducer';
import { getIntl } from '../selectors/user';
import { isChallengePending } from '../selectors/network';
import { getChallengeURL } from '../../challenge';

const mapStateToProps = (state: StateType) => {
  return {
    ...state.updates,
    isPending: isChallengePending(state),
    i18n: getIntl(state),

    onContinue() {
      document.location.href = getChallengeURL();
    },
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartCaptchaDialog = smart(CaptchaDialog);
