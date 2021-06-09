import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { DefaultTheme } from 'styled-components';
import { SessionIconSize, SessionIconType } from '../../components/session/icon';
import { SessionButtonColor } from '../../components/session/SessionButton';

export type ConfirmModalState = {
  message?: string;
  messageSub?: string;
  title?: string;
  onOk?: any;
  onClose?: any;
  onClickOk?: any;
  onClickClose?: any;
  okText?: string;
  cancelText?: string;
  hideCancel?: boolean;
  okTheme?: SessionButtonColor;
  closeTheme?: SessionButtonColor;
  sessionIcon?: SessionIconType;
  iconSize?: SessionIconSize;
  theme?: DefaultTheme;
} | null;

const initialState: ConfirmModalState = null;
// const initialState: any = { idk: 'hi'};

const confirmModalSlice = createSlice({
  name: 'confirmModal',
  initialState,
  reducers: {
    // updateConfirmModal(state, action: PayloadAction<ConfirmModalState>) {
    updateConfirmModal(state, action: any) {
      // return action.payload;

      // state.title = action.payload;
      state = action.payload;
      return action.payload;

      // state.confirmModal = action.payload;
    }
  }
})

const { actions, reducer } = confirmModalSlice;
export const { updateConfirmModal } = actions;
export const confirmModalReducer = reducer;