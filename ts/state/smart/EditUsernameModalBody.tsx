// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import { EditUsernameModalBody } from '../../components/EditUsernameModalBody';
import { getMinNickname, getMaxNickname } from '../../util/Username';
import { getIntl } from '../selectors/user';
import {
  getUsernameReservationState,
  getUsernameReservationObject,
  getUsernameReservationError,
  getRecoveredUsername,
} from '../selectors/username';
import { getUsernameCorrupted } from '../selectors/items';
import { getMe } from '../selectors/conversations';
import { useUsernameActions } from '../ducks/username';
import { useToastActions } from '../ducks/toast';

export type SmartEditUsernameModalBodyProps = Readonly<{
  isRootModal: boolean;
  onClose(): void;
}>;

export const SmartEditUsernameModalBody = memo(
  function SmartEditUsernameModalBody({
    isRootModal,
    onClose,
  }: SmartEditUsernameModalBodyProps) {
    const i18n = useSelector(getIntl);
    const { username } = useSelector(getMe);
    const usernameCorrupted = useSelector(getUsernameCorrupted);
    const currentUsername = usernameCorrupted ? undefined : username;
    const minNickname = getMinNickname();
    const maxNickname = getMaxNickname();
    const state = useSelector(getUsernameReservationState);
    const recoveredUsername = useSelector(getRecoveredUsername);
    const reservation = useSelector(getUsernameReservationObject);
    const error = useSelector(getUsernameReservationError);
    const {
      setUsernameReservationError,
      clearUsernameReservation,
      reserveUsername,
      confirmUsername,
    } = useUsernameActions();
    const { showToast } = useToastActions();
    return (
      <EditUsernameModalBody
        i18n={i18n}
        usernameCorrupted={usernameCorrupted}
        currentUsername={currentUsername}
        minNickname={minNickname}
        maxNickname={maxNickname}
        state={state}
        recoveredUsername={recoveredUsername}
        reservation={reservation}
        error={error}
        setUsernameReservationError={setUsernameReservationError}
        clearUsernameReservation={clearUsernameReservation}
        reserveUsername={reserveUsername}
        confirmUsername={confirmUsername}
        showToast={showToast}
        isRootModal={isRootModal}
        onClose={onClose}
      />
    );
  }
);
