// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';

import type { StateType } from '../reducer';
import type {
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
  ): SafetyNumberContactType | void => contacts[contactID]
);

export const getContactSafetyNumberSelector = createSelector(
  [getSafetyNumber],
  ({ contacts }) => {
    return (contactId: string) => {
      return contacts[contactId];
    };
  }
);
