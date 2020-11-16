// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import { UpdateDialog } from '../../components/UpdateDialog';
import { StateType } from '../reducer';
import { getIntl } from '../selectors/user';
import { hasNetworkDialog } from '../selectors/network';

const mapStateToProps = (state: StateType) => {
  return {
    ...state.updates,
    hasNetworkDialog: hasNetworkDialog(state),
    i18n: getIntl(state),
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartUpdateDialog = smart(UpdateDialog);
