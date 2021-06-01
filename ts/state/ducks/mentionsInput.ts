import { createSlice } from '@reduxjs/toolkit';

export type MentionsInputState = Array<{
  id: string;
  authorPhoneNumber: string;
  authorProfileName: string;
}>;

const initialState: MentionsInputState = [];

/**
 * This slice is the one holding the default joinable rooms fetched once in a while from the default opengroup v2 server.
 */
const mentionsInputSlice = createSlice({
  name: 'mentionsInput',
  initialState,
  reducers: {
    updateMentionsMembers(state, action) {
      window?.log?.warn('updating mentions input members', action.payload);
      return action.payload as MentionsInputState;
    },
  },
});

const { actions, reducer } = mentionsInputSlice;
export const { updateMentionsMembers } = actions;
export const defaultMentionsInputReducer = reducer;
