// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import { ExpiredBuildDialog } from '../../components/ExpiredBuildDialog';
import { StateType } from '../reducer';
import { getIntl } from '../selectors/user';

const mapStateToProps = (state: StateType) => {
  return {
    hasExpired: state.expiration.hasExpired,
    i18n: getIntl(state),
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartExpiredBuildDialog = smart(ExpiredBuildDialog);
