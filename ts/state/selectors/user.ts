import { createSelector } from 'reselect';

import { LocalizerType } from '../../types/Util';

import { StateType } from '../reducer';
import { UserStateType } from '../ducks/user';

export const getUser = (state: StateType): UserStateType => state.user;

export const getOurNumber = createSelector(
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
