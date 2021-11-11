// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import { DialogUpdate } from '../../components/DialogUpdate';
import type { StateType } from '../reducer';
import { getIntl } from '../selectors/user';
import { hasNetworkDialog } from '../selectors/network';
import type { WidthBreakpoint } from '../../components/_util';

type PropsType = Readonly<{ containerWidthBreakpoint: WidthBreakpoint }>;

const mapStateToProps = (state: StateType, ownProps: PropsType) => {
  return {
    ...state.updates,
    hasNetworkDialog: hasNetworkDialog(state),
    i18n: getIntl(state),
    currentVersion: window.getVersion(),
    ...ownProps,
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartUpdateDialog = smart(DialogUpdate);
