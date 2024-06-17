import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import { TermsOfServicePrivacyDialogProps } from '../../../components/dialog/TermsOfServicePrivacyDialog';

export type TermsOfServicePrivacyModalState = TermsOfServicePrivacyDialogProps | null;

export type ModalsState = {
  termsOfServicePrivacyModalState: TermsOfServicePrivacyModalState | null;
};

const initialState: ModalsState = {
  termsOfServicePrivacyModalState: null,
};

export const modalsSlice = createSlice({
  name: 'modals',
  initialState,
  reducers: {
    updateTermsOfServicePrivacyModal(
      state,
      action: PayloadAction<TermsOfServicePrivacyModalState>
    ) {
      return { ...state, termsOfServicePrivacyModalState: action.payload };
    },
  },
});

export const { updateTermsOfServicePrivacyModal } = modalsSlice.actions;
export default modalsSlice.reducer;
