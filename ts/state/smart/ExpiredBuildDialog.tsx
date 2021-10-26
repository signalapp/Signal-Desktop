// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import { DialogExpiredBuild } from '../../components/DialogExpiredBuild';
import type { StateType } from '../reducer';
import { getIntl } from '../selectors/user';
import type { WidthBreakpoint } from '../../components/_util';

type PropsType = Readonly<{ containerWidthBreakpoint: WidthBreakpoint }>;

const mapStateToProps = (state: StateType, ownProps: PropsType) => {
  return {
    hasExpired: state.expiration.hasExpired,
    i18n: getIntl(state),
    ...ownProps,
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartExpiredBuildDialog = smart(DialogExpiredBuild);
