// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import { UsernameEditor } from '../../components/UsernameEditor.dom.tsx';
import { getMinNickname, getMaxNickname } from '../../util/Username.dom.ts';
import { getIntl } from '../selectors/user.std.ts';
import {
  getUsernameReservationState,
  getUsernameReservationObject,
  getUsernameReservationError,
  getRecoveredUsername,
} from '../selectors/username.std.ts';
import { getUsernameCorrupted } from '../selectors/items.dom.ts';
import { getMe } from '../selectors/conversations.dom.ts';
import { useUsernameActions } from '../ducks/username.preload.ts';
import { useToastActions } from '../ducks/toast.preload.ts';

export type SmartUsernameEditorProps = Readonly<{
  onClose(): void;
}>;

export const SmartUsernameEditor = memo(function SmartUsernameEditor({
  onClose,
}: SmartUsernameEditorProps) {
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
    <UsernameEditor
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
      onClose={onClose}
    />
  );
});
