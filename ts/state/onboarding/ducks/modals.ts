import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import { TermsOfServicePrivacyDialogProps } from '../../../components/dialog/TermsOfServicePrivacyDialog';
import { ConfirmModalState } from '../../ducks/modalDialog';

export type TermsOfServicePrivacyModalState = TermsOfServicePrivacyDialogProps | null;

export type ModalsState = {
  quitModalState: ConfirmModalState | null;
  termsOfServicePrivacyModalState: TermsOfServicePrivacyModalState | null;
};

const initialState: ModalsState = {
  quitModalState: null,
  termsOfServicePrivacyModalState: null,
};

export const modalsSlice = createSlice({
  name: 'modals',
  initialState,
  reducers: {
    updateQuitModal(state, action: PayloadAction<ConfirmModalState>) {
      return { ...state, quitModalState: action.payload };
    },
    updateTermsOfServicePrivacyModal(
      state,
      action: PayloadAction<TermsOfServicePrivacyModalState>
    ) {
      return { ...state, termsOfServicePrivacyModalState: action.payload };
    },
  },
});

export const { updateQuitModal, updateTermsOfServicePrivacyModal } = modalsSlice.actions;
export default modalsSlice.reducer;
