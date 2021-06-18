import { createSelector } from 'reselect';

import { StateType } from '../reducer';
import {
  AddModeratorsModalState,
  ConfirmModalState,
  InviteContactModalState,
  ModalState,
  RemoveModeratorsModalState,
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
