// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';
import type { StateType } from '../reducer';

const getInboxState = (state: StateType) => state.inbox;

export const getInboxEnvelopeTimestamp = createSelector(
  getInboxState,
  ({ envelopeTimestamp }) => envelopeTimestamp
);

export const getInboxFirstEnvelopeTimestamp = createSelector(
  getInboxState,
  ({ firstEnvelopeTimestamp }) => firstEnvelopeTimestamp
);
