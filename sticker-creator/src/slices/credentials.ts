// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable no-param-reassign */
import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

import type { Credentials } from '../types.d';

export type CredentialsState = {
  credentials?: Credentials;
};

const initialState: CredentialsState = {
  credentials: undefined,
};

export const credentialsSlice = createSlice({
  name: 'credentials',
  initialState,
  reducers: {
    setCredentials: (
      state,
      { payload }: PayloadAction<Credentials | undefined>
    ) => {
      state.credentials = payload;
    },
  },
});

export const { setCredentials } = credentialsSlice.actions;
export default credentialsSlice.reducer;
