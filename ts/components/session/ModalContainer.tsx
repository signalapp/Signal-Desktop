import React from 'react';
import { useSelector } from 'react-redux';
import {
  getAddModeratorsModal,
  getAdminLeaveClosedGroupDialog,
  getChangeNickNameDialog,
  getConfirmModal,
  getDeleteAccountModalState,
  getEditProfileDialog,
  getInviteContactModal,
  getOnionPathDialog,
  getRecoveryPhraseDialog,
  getRemoveModeratorsModal,
  getSessionPasswordDialog,
  getUpdateGroupMembersModal,
  getUpdateGroupNameModal,
  getUserDetailsModal,
} from '../../state/selectors/modal';
import { AdminLeaveClosedGroupDialog } from '../conversation/AdminLeaveClosedGroupDialog';
import { InviteContactsDialog } from '../conversation/InviteContactsDialog';
import { AddModeratorsDialog } from '../conversation/ModeratorsAddDialog';
import { RemoveModeratorsDialog } from '../conversation/ModeratorsRemoveDialog';
import { UpdateGroupMembersDialog } from '../conversation/UpdateGroupMembersDialog';
import { UpdateGroupNameDialog } from '../conversation/UpdateGroupNameDialog';
import { DeleteAccountModal } from '../dialog/DeleteAccountModal';
import { EditProfileDialog } from '../EditProfileDialog';
import { OnionPathModal } from '../OnionStatusPathDialog';
import { UserDetailsDialog } from '../UserDetailsDialog';
import { SessionConfirm } from './SessionConfirm';
import { SessionNicknameDialog } from './SessionNicknameDialog';
import { SessionPasswordModal } from './SessionPasswordModal';
import { SessionSeedModal } from './SessionSeedModal';

export const ModalContainer = () => {
  const confirmModalState = useSelector(getConfirmModal);
  const inviteModalState = useSelector(getInviteContactModal);
  const addModeratorsModalState = useSelector(getAddModeratorsModal);
  const removeModeratorsModalState = useSelector(getRemoveModeratorsModal);
  const updateGroupMembersModalState = useSelector(getUpdateGroupMembersModal);
  const updateGroupNameModalState = useSelector(getUpdateGroupNameModal);
  const userDetailsModalState = useSelector(getUserDetailsModal);
  const changeNicknameModal = useSelector(getChangeNickNameDialog);
  const editProfileModalState = useSelector(getEditProfileDialog);
  const onionPathModalState = useSelector(getOnionPathDialog);
  const recoveryPhraseModalState = useSelector(getRecoveryPhraseDialog);
  const adminLeaveClosedGroupModalState = useSelector(getAdminLeaveClosedGroupDialog);
  const sessionPasswordModalState = useSelector(getSessionPasswordDialog);
  const deleteAccountModalState = useSelector(getDeleteAccountModalState);

  return (
    <>
      {confirmModalState && <SessionConfirm {...confirmModalState} />}
      {inviteModalState && <InviteContactsDialog {...inviteModalState} />}
      {addModeratorsModalState && <AddModeratorsDialog {...addModeratorsModalState} />}
      {removeModeratorsModalState && <RemoveModeratorsDialog {...removeModeratorsModalState} />}
      {updateGroupMembersModalState && (
        <UpdateGroupMembersDialog {...updateGroupMembersModalState} />
      )}
      {updateGroupNameModalState && <UpdateGroupNameDialog {...updateGroupNameModalState} />}
      {userDetailsModalState && <UserDetailsDialog {...userDetailsModalState} />}
      {changeNicknameModal && <SessionNicknameDialog {...changeNicknameModal} />}
      {editProfileModalState && <EditProfileDialog {...editProfileModalState} />}
      {onionPathModalState && <OnionPathModal {...onionPathModalState} />}
      {recoveryPhraseModalState && <SessionSeedModal {...recoveryPhraseModalState} />}
      {adminLeaveClosedGroupModalState && (
        <AdminLeaveClosedGroupDialog {...adminLeaveClosedGroupModalState} />
      )}
      {sessionPasswordModalState && <SessionPasswordModal {...sessionPasswordModalState} />}
      {deleteAccountModalState && <DeleteAccountModal {...deleteAccountModalState} />}
    </>
  );
};
