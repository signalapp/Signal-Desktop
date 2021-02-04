// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import { RelinkDialog } from '../../components/RelinkDialog';
import { StateType } from '../reducer';
import { getIntl } from '../selectors/user';
import { isDone } from '../../util/registration';

const mapStateToProps = (state: StateType) => {
  return {
    i18n: getIntl(state),
    isRegistrationDone: isDone(),
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartRelinkDialog = smart(RelinkDialog);
