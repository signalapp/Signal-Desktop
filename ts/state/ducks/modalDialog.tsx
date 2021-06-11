import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { SessionConfirmDialogProps  } from '../../components/session/SessionConfirm';

export type ConfirmModalState = SessionConfirmDialogProps | null;

const initialState: ConfirmModalState = null as ConfirmModalState;

const confirmModalSlice = createSlice({
  name: 'confirmModal',
  initialState,
  reducers: {
    updateConfirmModal(state, action: PayloadAction<ConfirmModalState | null>) {
      state = action.payload;
      return action.payload;
    }
  }
})

export const { actions, reducer } = confirmModalSlice;
export const { updateConfirmModal } = actions;
export const confirmModalReducer = reducer;