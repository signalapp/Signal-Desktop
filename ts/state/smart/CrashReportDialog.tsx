// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import { CrashReportDialog } from '../../components/CrashReportDialog';
import type { StateType } from '../reducer';
import { getIntl } from '../selectors/user';

const mapStateToProps = (state: StateType) => {
  return {
    ...state.crashReports,
    i18n: getIntl(state),
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartCrashReportDialog = smart(CrashReportDialog);
