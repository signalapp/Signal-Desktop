import { createSelector } from '@reduxjs/toolkit';

import { StateType } from '../reducer';
import {
  AddModeratorsModalState,
  BanOrUnbanUserModalState,
  ChangeNickNameModalState,
  ConfirmModalState,
  DeleteAccountModalState,
  EditProfileModalState,
  EditProfilePictureModalState,
  InviteContactModalState,
  ModalState,
  OnionPathModalState,
  ReactModalsState,
  RecoveryPhraseModalState,
  RemoveModeratorsModalState,
  SessionPasswordModalState,
  UpdateGroupMembersModalState,
  UpdateGroupNameModalState,
  UserDetailsModalState,
} from '../ducks/modalDialog';

export const getModal = (state: StateType): ModalState => {
  return state.modals;
};

export const getConfirmModal = createSelector(
  getModal,
  (state: ModalState): ConfirmModalState => state.confirmModal
);

export const getInviteContactModal = createSelector(
  getModal,
  (state: ModalState): InviteContactModalState => state.inviteContactModal
);

export const getAddModeratorsModal = createSelector(
  getModal,
  (state: ModalState): AddModeratorsModalState => state.addModeratorsModal
);

export const getRemoveModeratorsModal = createSelector(
  getModal,
  (state: ModalState): RemoveModeratorsModalState => state.removeModeratorsModal
);

export const getBanOrUnbanUserModalState = createSelector(
  getModal,
  (state: ModalState): BanOrUnbanUserModalState => state.banOrUnbanUserModal
);

export const getUpdateGroupNameModal = createSelector(
  getModal,
  (state: ModalState): UpdateGroupNameModalState => state.groupNameModal
);

export const getUpdateGroupMembersModal = createSelector(
  getModal,
  (state: ModalState): UpdateGroupMembersModalState => state.groupMembersModal
);

export const getUserDetailsModal = createSelector(
  getModal,
  (state: ModalState): UserDetailsModalState => state.userDetailsModal
);

export const getChangeNickNameDialog = createSelector(
  getModal,
  (state: ModalState): ChangeNickNameModalState => state.nickNameModal
);

export const getEditProfileDialog = createSelector(
  getModal,
  (state: ModalState): EditProfileModalState => state.editProfileModal
);

export const getOnionPathDialog = createSelector(
  getModal,
  (state: ModalState): OnionPathModalState => state.onionPathModal
);

export const getRecoveryPhraseDialog = createSelector(
  getModal,
  (state: ModalState): RecoveryPhraseModalState => state.recoveryPhraseModal
);

export const getSessionPasswordDialog = createSelector(
  getModal,
  (state: ModalState): SessionPasswordModalState => state.sessionPasswordModal
);

export const getDeleteAccountModalState = createSelector(
  getModal,
  (state: ModalState): DeleteAccountModalState => state.deleteAccountModal
);

export const getReactListDialog = createSelector(
  getModal,
  (state: ModalState): ReactModalsState => state.reactListModalState
);

export const getReactClearAllDialog = createSelector(
  getModal,
  (state: ModalState): ReactModalsState => state.reactClearAllModalState
);

export const getEditProfilePictureModalState = createSelector(
  getModal,
  (state: ModalState): EditProfilePictureModalState => state.editProfilePictureModalState
);
