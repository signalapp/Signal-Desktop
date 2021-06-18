import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { SessionConfirmDialogProps } from '../../components/session/SessionConfirm';

export type ConfirmModalState = SessionConfirmDialogProps | null;
export type InviteContactModalState = { conversationId: string } | null;
export type AddModeratorsModalState = { conversationId: string } | null;
export type RemoveModeratorsModalState = { conversationId: string } | null;
export type UpdateGroupMembersModalState = { conversationId: string } | null;
export type UpdateGroupNameModalState = { conversationId: string } | null;
export type UserDetailsModalState = {
  conversationId: string;
  authorAvatarPath?: string;
  userName: string;
} | null;

export type ModalState = {
  confirmModal: ConfirmModalState;
  inviteContactModal: InviteContactModalState;
  addModeratorsModal: AddModeratorsModalState;
  removeModeratorsModal: RemoveModeratorsModalState;
  groupNameModal: UpdateGroupNameModalState;
  groupMembersModal: UpdateGroupMembersModalState;
  userDetailsModal: UserDetailsModalState;
};

export const initialModalState: ModalState = {
  confirmModal: null,
  inviteContactModal: null,
  addModeratorsModal: null,
  removeModeratorsModal: null,
  groupNameModal: null,
  groupMembersModal: null,
  userDetailsModal: null,
};

const ModalSlice = createSlice({
  name: 'modals',
  initialState: initialModalState,
  reducers: {
    updateConfirmModal(state, action: PayloadAction<ConfirmModalState | null>) {
      return { ...state, confirmModal: action.payload };
    },
    updateInviteContactModal(state, action: PayloadAction<InviteContactModalState | null>) {
      return { ...state, inviteContactModal: action.payload };
    },
    updateAddModeratorsModal(state, action: PayloadAction<AddModeratorsModalState | null>) {
      return { ...state, addModeratorsModal: action.payload };
    },
    updateRemoveModeratorsModal(state, action: PayloadAction<RemoveModeratorsModalState | null>) {
      return { ...state, removeModeratorsModal: action.payload };
    },
    updateGroupNameModal(state, action: PayloadAction<UpdateGroupNameModalState | null>) {
      return { ...state, groupNameModal: action.payload };
    },
    updateGroupMembersModal(state, action: PayloadAction<UpdateGroupMembersModalState | null>) {
      return { ...state, groupMembersModal: action.payload };
    },
    updateUserDetailsModal(state, action: PayloadAction<UserDetailsModalState | null>) {
      return { ...state, userDetailsModal: action.payload };
    },
  },
});

export const { actions, reducer } = ModalSlice;
export const {
  updateConfirmModal,
  updateInviteContactModal,
  updateAddModeratorsModal,
  updateRemoveModeratorsModal,
  updateGroupNameModal,
  updateGroupMembersModal,
  updateUserDetailsModal,
} = actions;
export const modalReducer = reducer;
