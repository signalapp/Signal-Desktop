import React from 'react';
import { useSelector } from 'react-redux';
import {
  getAddModeratorsModal,
  getBanOrUnbanUserModalState,
  getChangeNickNameDialog,
  getConfirmModal,
  getDeleteAccountModalState,
  getEditProfileDialog,
  getEditProfilePictureModalState,
  getInviteContactModal,
  getOnionPathDialog,
  getReactClearAllDialog,
  getReactListDialog,
  getRecoveryPhraseDialog,
  getRemoveModeratorsModal,
  getSessionPasswordDialog,
  getUpdateGroupMembersModal,
  getUpdateGroupNameModal,
  getUserDetailsModal,
} from '../../state/selectors/modal';
import { InviteContactsDialog } from './InviteContactsDialog';
import { DeleteAccountModal } from './DeleteAccountModal';
import { EditProfileDialog } from './EditProfileDialog';
import { OnionPathModal } from './OnionStatusPathDialog';
import { UserDetailsDialog } from './UserDetailsDialog';
import { SessionConfirm } from './SessionConfirm';
import { SessionPasswordDialog } from './SessionPasswordDialog';
import { SessionSeedModal } from './SessionSeedModal';
import { AddModeratorsDialog } from './ModeratorsAddDialog';
import { RemoveModeratorsDialog } from './ModeratorsRemoveDialog';
import { UpdateGroupMembersDialog } from './UpdateGroupMembersDialog';
import { UpdateGroupNameDialog } from './UpdateGroupNameDialog';
import { SessionNicknameDialog } from './SessionNicknameDialog';
import { BanOrUnBanUserDialog } from './BanOrUnbanUserDialog';
import { ReactListModal } from './ReactListModal';
import { ReactClearAllModal } from './ReactClearAllModal';
import { EditProfilePictureModal } from './EditProfilePictureModal';

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
  const sessionPasswordModalState = useSelector(getSessionPasswordDialog);
  const deleteAccountModalState = useSelector(getDeleteAccountModalState);
  const banOrUnbanUserModalState = useSelector(getBanOrUnbanUserModalState);
  const reactListModalState = useSelector(getReactListDialog);
  const reactClearAllModalState = useSelector(getReactClearAllDialog);
  const editProfilePictureModalState = useSelector(getEditProfilePictureModalState);

  return (
    <>
      {banOrUnbanUserModalState && <BanOrUnBanUserDialog {...banOrUnbanUserModalState} />}
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
      {sessionPasswordModalState && <SessionPasswordDialog {...sessionPasswordModalState} />}
      {deleteAccountModalState && <DeleteAccountModal {...deleteAccountModalState} />}
      {confirmModalState && <SessionConfirm {...confirmModalState} />}
      {reactListModalState && <ReactListModal {...reactListModalState} />}
      {reactClearAllModalState && <ReactClearAllModal {...reactClearAllModalState} />}
      {editProfilePictureModalState && (
        <EditProfilePictureModal {...editProfilePictureModalState} />
      )}
    </>
  );
};
