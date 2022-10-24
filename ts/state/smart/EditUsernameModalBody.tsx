// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';

import type { PropsDataType } from '../../components/EditUsernameModalBody';
import { EditUsernameModalBody } from '../../components/EditUsernameModalBody';
import { getMinNickname, getMaxNickname } from '../../util/Username';

import type { StateType } from '../reducer';
import { getIntl } from '../selectors/user';
import {
  getUsernameReservationState,
  getUsernameReservationObject,
  getUsernameReservationError,
} from '../selectors/username';
import { getMe } from '../selectors/conversations';

function mapStateToProps(state: StateType): PropsDataType {
  const i18n = getIntl(state);
  const { username } = getMe(state);

  return {
    i18n,
    currentUsername: username,
    minNickname: getMinNickname(),
    maxNickname: getMaxNickname(),
    state: getUsernameReservationState(state),
    reservation: getUsernameReservationObject(state),
    error: getUsernameReservationError(state),
  };
}

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartEditUsernameModalBody = smart(EditUsernameModalBody);
