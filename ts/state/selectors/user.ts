import { createSelector } from '@reduxjs/toolkit';

import { LocalizerType } from '../../types/Util';

import { StateType } from '../reducer';
import { UserStateType } from '../ducks/user';

export const getUser = (state: StateType): UserStateType => state.user;

export const getOurNumber = createSelector(
  getUser,
  (state: UserStateType): string => state.ourNumber
);

export const getOurDisplayNameInProfile = createSelector(
  getUser,
  (state: UserStateType): string => state.ourDisplayNameInProfile
);

export const getIntl = createSelector(getUser, (): LocalizerType => window.i18n);
