import { createSelector } from 'reselect';

import { StateType } from '../reducer';
import { ItemsStateType } from '../ducks/items';

const getItems = (state: StateType): ItemsStateType => state.items;

export const isDone = createSelector(
  getItems,
  (state: ItemsStateType): boolean => state.chromiumRegistrationDone === ''
);

export const everDone = createSelector(
  getItems,
  (state: ItemsStateType): boolean =>
    state.chromiumRegistrationDoneEver === '' ||
    state.chromiumRegistrationDone === ''
);
