import { createSelector } from 'reselect';

import { LocalizerType } from '../../types/Util';

import { StateType } from '../reducer';
import { UserStateType } from '../ducks/user';

export const getUser = (state: StateType): UserStateType => state.user;

export const getUserNumber = createSelector(
  getUser,
  (state: UserStateType): string => state.ourNumber
);

export const getRegionCode = createSelector(
  getUser,
  (state: UserStateType): string => state.regionCode
);

export const getIntl = createSelector(
  getUser,
  (state: UserStateType): LocalizerType => state.i18n
);

export const getAttachmentsPath = createSelector(
  getUser,
  (state: UserStateType): string => state.attachmentsPath
);

export const getStickersPath = createSelector(
  getUser,
  (state: UserStateType): string => state.stickersPath
);

export const getTempPath = createSelector(
  getUser,
  (state: UserStateType): string => state.tempPath
);
