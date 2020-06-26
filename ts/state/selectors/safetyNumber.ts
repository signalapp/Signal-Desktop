import { createSelector } from 'reselect';

import { StateType } from '../reducer';
import {
  SafetyNumberContactType,
  SafetyNumberStateType,
} from '../ducks/safetyNumber';

const getSafetyNumber = (state: StateType): SafetyNumberStateType =>
  state.safetyNumber;

type Props = {
  contactID: string;
};

const getContactID = (_: StateType, props: Props): string => props.contactID;

export const getContactSafetyNumber = createSelector(
  [getSafetyNumber, getContactID],
  (
    { contacts }: SafetyNumberStateType,
    contactID: string
  ): SafetyNumberContactType => contacts[contactID]
);
