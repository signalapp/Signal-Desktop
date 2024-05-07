import { useSelector } from 'react-redux';
import {
  getAddModeratorsModal,
  getBanOrUnbanUserModalState,
  getChangeNickNameDialog,
  getConfirmModal,
  getDeleteAccountModalState,
  getEditProfileDialog,
  getEditProfilePictureModalState,
  getEnterPasswordModalState,
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
import { BanOrUnBanUserDialog } from './BanOrUnbanUserDialog';
import { DeleteAccountModal } from './DeleteAccountModal';
import { EditProfileDialog } from './EditProfileDialog';
import { EditProfilePictureModal } from './EditProfilePictureModal';
import { EnterPasswordModal } from './EnterPasswordModal';
import { InviteContactsDialog } from './InviteContactsDialog';
import { AddModeratorsDialog } from './ModeratorsAddDialog';
import { RemoveModeratorsDialog } from './ModeratorsRemoveDialog';
import { OnionPathModal } from './OnionStatusPathDialog';
import { ReactClearAllModal } from './ReactClearAllModal';
import { ReactListModal } from './ReactListModal';
import { SessionConfirm } from './SessionConfirm';
import { SessionNicknameDialog } from './SessionNicknameDialog';
import { SessionSeedModal } from './SessionSeedModal';
import { SessionSetPasswordDialog } from './SessionSetPasswordDialog';
import { UpdateGroupMembersDialog } from './UpdateGroupMembersDialog';
import { UpdateGroupNameDialog } from './UpdateGroupNameDialog';
import { UserDetailsDialog } from './UserDetailsDialog';

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
  const enterPasswordModalState = useSelector(getEnterPasswordModalState);
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
      {enterPasswordModalState && <EnterPasswordModal {...enterPasswordModalState} />}
      {sessionPasswordModalState && <SessionSetPasswordDialog {...sessionPasswordModalState} />}
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
