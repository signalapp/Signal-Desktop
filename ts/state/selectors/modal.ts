import { createSelector } from '@reduxjs/toolkit';

import {
  AddModeratorsModalState,
  BanOrUnbanUserModalState,
  ChangeNickNameModalState,
  ConfirmModalState,
  DeleteAccountModalState,
  EditProfileModalState,
  EditProfilePictureModalState,
  EnterPasswordModalState,
  HideRecoveryPasswordModalState,
  InviteContactModalState,
  LightBoxOptions,
  ModalState,
  OnionPathModalState,
  ReactModalsState,
  RemoveModeratorsModalState,
  SessionPasswordModalState,
  UpdateGroupMembersModalState,
  UpdateGroupNameModalState,
  UserDetailsModalState,
} from '../ducks/modalDialog';
import { StateType } from '../reducer';

export const getModal = (state: StateType): ModalState => {
  return state.modals;
};

export const getIsModalVisble = createSelector(getModal, (state: ModalState): boolean => {
  const modalValues = Object.values(state);
  for (let i = 0; i < modalValues.length; i++) {
    if (modalValues[i] !== null) {
      return true;
    }
  }

  return false;
});

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

export const getEnterPasswordModalState = createSelector(
  getModal,
  (state: ModalState): EnterPasswordModalState => state.enterPasswordModal
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

export const getHideRecoveryPasswordModalState = createSelector(
  getModal,
  (state: ModalState): HideRecoveryPasswordModalState => state.hideRecoveryPasswordModalState
);

export const getLightBoxOptions = createSelector(
  getModal,
  (state: ModalState): LightBoxOptions => state.lightBoxOptions
);
