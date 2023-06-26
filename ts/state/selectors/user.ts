import { createSelector } from '@reduxjs/toolkit';

import { LocalizerType } from '../../types/Util';

import { StateType } from '../reducer';
import { UserStateType } from '../ducks/user';
import { isRtlBody } from '../../components/menu/Menu';

export const getUser = (state: StateType): UserStateType => state.user;

export const getOurNumber = createSelector(
  getUser,
  (state: UserStateType): string => state.ourNumber
);

export const getIntl = createSelector(getUser, (): LocalizerType => window.i18n);

export const getWritingDirection = createSelector(getUser, (): string =>
  isRtlBody() ? 'rtl' : 'ltr'
);
