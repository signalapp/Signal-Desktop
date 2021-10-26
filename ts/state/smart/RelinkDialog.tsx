// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import { DialogRelink } from '../../components/DialogRelink';
import type { StateType } from '../reducer';
import { getIntl } from '../selectors/user';
import { isDone } from '../../util/registration';
import type { WidthBreakpoint } from '../../components/_util';

type PropsType = Readonly<{ containerWidthBreakpoint: WidthBreakpoint }>;

const mapStateToProps = (state: StateType, ownProps: PropsType) => {
  return {
    i18n: getIntl(state),
    isRegistrationDone: isDone(),
    ...ownProps,
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartRelinkDialog = smart(DialogRelink);
