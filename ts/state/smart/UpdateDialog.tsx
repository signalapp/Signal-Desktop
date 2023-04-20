// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import { DialogUpdate } from '../../components/DialogUpdate';
import type { StateType } from '../reducer';
import { getIntl } from '../selectors/user';
import { getExpirationTimestamp } from '../selectors/expiration';
import type { WidthBreakpoint } from '../../components/_util';
import OS from '../../util/os/osMain';

type PropsType = Readonly<{ containerWidthBreakpoint: WidthBreakpoint }>;

const mapStateToProps = (state: StateType, ownProps: PropsType) => {
  return {
    ...state.updates,
    i18n: getIntl(state),
    currentVersion: window.getVersion(),
    expirationTimestamp: getExpirationTimestamp(state),
    OS: OS.getName(),
    ...ownProps,
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartUpdateDialog = smart(DialogUpdate);
