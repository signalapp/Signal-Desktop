// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadonlyDeep } from 'type-fest';

// State

// eslint-disable-next-line local-rules/type-alias-readonlydeep
export type InboxStateType = Readonly<{
  firstEnvelopeTimestamp: number | undefined;
  envelopeTimestamp: number | undefined;
}>;

// Actions

const SET_ENVELOPE_TIMESTAMP = 'INBOX/SET_INBOX_ENVELOPE_TIMESTAMP';

type SetInboxEnvelopeTimestampActionType = ReadonlyDeep<{
  type: typeof SET_ENVELOPE_TIMESTAMP;
  payload: {
    envelopeTimestamp: number | undefined;
  };
}>;

export type InboxActionType = ReadonlyDeep<SetInboxEnvelopeTimestampActionType>;

// Action Creators

export const actions = {
  setInboxEnvelopeTimestamp,
};

function setInboxEnvelopeTimestamp(
  envelopeTimestamp: number | undefined
): SetInboxEnvelopeTimestampActionType {
  return {
    type: SET_ENVELOPE_TIMESTAMP,
    payload: { envelopeTimestamp },
  };
}

// Reducer

export function getEmptyState(): InboxStateType {
  return {
    firstEnvelopeTimestamp: undefined,
    envelopeTimestamp: undefined,
  };
}

export function reducer(
  state: Readonly<InboxStateType> = getEmptyState(),
  action: Readonly<InboxActionType>
): InboxStateType {
  if (!state) {
    return getEmptyState();
  }

  if (action.type === SET_ENVELOPE_TIMESTAMP) {
    const { payload } = action;
    const { envelopeTimestamp: providedTimestamp } = payload;

    // Ensure monotonicity
    let { envelopeTimestamp } = state;
    if (providedTimestamp !== undefined) {
      envelopeTimestamp = Math.max(
        providedTimestamp,
        envelopeTimestamp ?? providedTimestamp
      );
    }

    const firstEnvelopeTimestamp =
      state.firstEnvelopeTimestamp ?? envelopeTimestamp;

    return {
      ...state,
      envelopeTimestamp,
      firstEnvelopeTimestamp,
    };
  }

  return state;
}
