import React from 'react';

import { Item } from 'react-contexify';
import { useDispatch, useSelector } from 'react-redux';
import {
  useAvatarPath,
  useConversationUsername,
  useHasNickname,
  useIsBlinded,
  useIsBlocked,
  useIsIncomingRequest,
  useIsKickedFromGroup,
  useIsLeft,
  useIsMe,
  useIsPrivate,
  useIsPrivateAndFriend,
  useIsPublic,
  useWeAreAdmin,
} from '../../hooks/useParamSelector';
import {
  approveConvoAndSendResponse,
  blockConvoById,
  clearNickNameByConvoId,
  copyPublicKeyByConvoId,
  declineConversationWithConfirm,
  deleteAllMessagesByConvoIdWithConfirmation,
  markAllReadByConvoId,
  showAddModeratorsByConvoId,
  showBanUserByConvoId,
  showInviteContactByConvoId,
  showLeaveGroupByConvoId,
  showRemoveModeratorsByConvoId,
  showUnbanUserByConvoId,
  showUpdateGroupNameByConvoId,
  unblockConvoById,
} from '../../interactions/conversationInteractions';
import { getConversationController } from '../../session/conversations';
import { PubKey } from '../../session/types';
import {
  changeNickNameModal,
  updateConfirmModal,
  updateUserDetailsModal,
} from '../../state/ducks/modalDialog';
import { getIsMessageSection } from '../../state/selectors/section';
import { useSelectedConversationKey } from '../../state/selectors/selectedConversation';
import { SessionButtonColor } from '../basic/SessionButton';
import { useConvoIdFromContext } from '../leftpane/conversation-list-item/ConvoIdContext';

/** Menu items standardized */

export const InviteContactMenuItem = (): JSX.Element | null => {
  const convoId = useConvoIdFromContext();
  const isPublic = useIsPublic(convoId);

  if (isPublic) {
    return (
      <Item
        onClick={() => {
          showInviteContactByConvoId(convoId);
        }}
      >
        {window.i18n('inviteContacts')}
      </Item>
    );
  }
  return null;
};

export const MarkConversationUnreadMenuItem = (): JSX.Element | null => {
  const conversationId = useConvoIdFromContext();
  const isMessagesSection = useSelector(getIsMessageSection);
  const isPrivate = useIsPrivate(conversationId);
  const isPrivateAndFriend = useIsPrivateAndFriend(conversationId);

  if (isMessagesSection && (!isPrivate || (isPrivate && isPrivateAndFriend))) {
    const conversation = getConversationController().get(conversationId);

    const markUnread = async () => {
      await conversation?.markAsUnread(true);
    };

    return <Item onClick={markUnread}>{window.i18n('markUnread')}</Item>;
  }
  return null;
};

/**
 * This menu item can be used to completely remove a contact and reset the flags of that conversation.
 * i.e. after confirmation is made, this contact will be removed from the ContactWrapper, and its blocked and approved state reset.
 * Note: We keep the entry in the database as the user profile might still be needed for communities/groups where this user.
 */
export const DeletePrivateContactMenuItem = () => {
  const dispatch = useDispatch();
  const convoId = useConvoIdFromContext();
  const isPrivate = useIsPrivate(convoId);
  const isRequest = useIsIncomingRequest(convoId);

  if (isPrivate && !isRequest) {
    let menuItemText: string;

    menuItemText = window.i18n('editMenuDeleteContact');

    const onClickClose = () => {
      dispatch(updateConfirmModal(null));
    };

    const showConfirmationModal = () => {
      dispatch(
        updateConfirmModal({
          title: menuItemText,
          message: window.i18n('deleteContactConfirmation'),
          onClickClose,
          okTheme: SessionButtonColor.Danger,
          onClickOk: async () => {
            await getConversationController().deleteContact(convoId, {
              fromSyncMessage: false,
              justHidePrivate: false,
            });
          },
        })
      );
    };

    return <Item onClick={showConfirmationModal}>{menuItemText}</Item>;
  }
  return null;
};

export const DeleteGroupOrCommunityMenuItem = () => {
  const dispatch = useDispatch();
  const convoId = useConvoIdFromContext();
  const isPublic = useIsPublic(convoId);
  const isLeft = useIsLeft(convoId);
  const isKickedFromGroup = useIsKickedFromGroup(convoId);
  const isPrivate = useIsPrivate(convoId);
  const isGroup = !isPrivate && !isPublic;

  // You need to have left a closed group first to be able to delete it completely as there is a leaving message to send first.
  // A community can just be removed right away.
  if (isPublic || (isGroup && (isLeft || isKickedFromGroup))) {
    const menuItemText = isPublic ? window.i18n('leaveGroup') : window.i18n('editMenuDeleteGroup');

    const onClickClose = () => {
      dispatch(updateConfirmModal(null));
    };

    const showConfirmationModal = () => {
      dispatch(
        updateConfirmModal({
          title: menuItemText,
          message: window.i18n('leaveGroupConfirmation'),
          onClickClose,
          okTheme: SessionButtonColor.Danger,
          onClickOk: async () => {
            await getConversationController().deleteContact(convoId, {
              fromSyncMessage: false,
            });
          },
        })
      );
    };

    return <Item onClick={showConfirmationModal}>{menuItemText}</Item>;
  }
  return null;
};

export const LeaveGroupMenuItem = () => {
  const convoId = useConvoIdFromContext();
  const isPublic = useIsPublic(convoId);
  const isLeft = useIsLeft(convoId);
  const isKickedFromGroup = useIsKickedFromGroup(convoId);
  const isPrivate = useIsPrivate(convoId);

  if (!isKickedFromGroup && !isLeft && !isPrivate && !isPublic) {
    return (
      <Item
        onClick={() => {
          showLeaveGroupByConvoId(convoId);
        }}
      >
        {window.i18n('leaveGroup')}
      </Item>
    );
  }

  return null;
};

export const ShowUserDetailsMenuItem = () => {
  const dispatch = useDispatch();
  const convoId = useConvoIdFromContext();
  const isPrivate = useIsPrivate(convoId);
  const avatarPath = useAvatarPath(convoId);
  const userName = useConversationUsername(convoId) || convoId;
  const isBlinded = useIsBlinded(convoId);

  if (isPrivate && !isBlinded) {
    return (
      <Item
        onClick={() => {
          dispatch(
            updateUserDetailsModal({
              conversationId: convoId,
              userName,
              authorAvatarPath: avatarPath,
            })
          );
        }}
      >
        {window.i18n('showUserDetails')}
      </Item>
    );
  }

  return null;
};

export const UpdateGroupNameMenuItem = () => {
  const convoId = useConvoIdFromContext();
  const left = useIsLeft(convoId);
  const isKickedFromGroup = useIsKickedFromGroup(convoId);
  const weAreAdmin = useWeAreAdmin(convoId);

  if (!isKickedFromGroup && !left && weAreAdmin) {
    return (
      <Item
        onClick={async () => {
          await showUpdateGroupNameByConvoId(convoId);
        }}
      >
        {window.i18n('editGroup')}
      </Item>
    );
  }
  return null;
};

export const RemoveModeratorsMenuItem = (): JSX.Element | null => {
  const convoId = useConvoIdFromContext();
  const isPublic = useIsPublic(convoId);
  const isKickedFromGroup = useIsKickedFromGroup(convoId);
  const weAreAdmin = useWeAreAdmin(convoId);

  if (!isKickedFromGroup && weAreAdmin && isPublic) {
    return (
      <Item
        onClick={() => {
          showRemoveModeratorsByConvoId(convoId);
        }}
      >
        {window.i18n('removeModerators')}
      </Item>
    );
  }
  return null;
};

export const AddModeratorsMenuItem = (): JSX.Element | null => {
  const convoId = useConvoIdFromContext();
  const isPublic = useIsPublic(convoId);
  const isKickedFromGroup = useIsKickedFromGroup(convoId);
  const weAreAdmin = useWeAreAdmin(convoId);

  if (!isKickedFromGroup && weAreAdmin && isPublic) {
    return (
      <Item
        onClick={() => {
          showAddModeratorsByConvoId(convoId);
        }}
      >
        {window.i18n('addModerators')}
      </Item>
    );
  }
  return null;
};

export const UnbanMenuItem = (): JSX.Element | null => {
  const convoId = useConvoIdFromContext();
  const isPublic = useIsPublic(convoId);
  const isKickedFromGroup = useIsKickedFromGroup(convoId);
  const weAreAdmin = useWeAreAdmin(convoId);

  if (isPublic && !isKickedFromGroup && weAreAdmin) {
    return (
      <Item
        onClick={() => {
          showUnbanUserByConvoId(convoId);
        }}
      >
        {window.i18n('unbanUser')}
      </Item>
    );
  }
  return null;
};

export const BanMenuItem = (): JSX.Element | null => {
  const convoId = useConvoIdFromContext();
  const isPublic = useIsPublic(convoId);
  const isKickedFromGroup = useIsKickedFromGroup(convoId);
  const weAreAdmin = useWeAreAdmin(convoId);

  if (isPublic && !isKickedFromGroup && weAreAdmin) {
    return (
      <Item
        onClick={() => {
          showBanUserByConvoId(convoId);
        }}
      >
        {window.i18n('banUser')}
      </Item>
    );
  }
  return null;
};

export const CopyMenuItem = (): JSX.Element | null => {
  const convoId = useConvoIdFromContext();
  const isPublic = useIsPublic(convoId);
  const isPrivate = useIsPrivate(convoId);
  const isBlinded = useIsBlinded(convoId);

  // we want to show the copyId for open groups and private chats only

  if ((isPrivate && !isBlinded) || isPublic) {
    const copyIdLabel = isPublic ? window.i18n('copyOpenGroupURL') : window.i18n('copySessionID');
    return (
      <Item
        onClick={() => {
          void copyPublicKeyByConvoId(convoId);
        }}
      >
        {copyIdLabel}
      </Item>
    );
  }
  return null;
};

export const MarkAllReadMenuItem = (): JSX.Element | null => {
  const convoId = useConvoIdFromContext();
  const isIncomingRequest = useIsIncomingRequest(convoId);
  if (!isIncomingRequest && !PubKey.hasBlindedPrefix(convoId)) {
    return (
      <Item onClick={() => markAllReadByConvoId(convoId)}>{window.i18n('markAllAsRead')}</Item>
    );
  } else {
    return null;
  }
};

export function isRtlBody(): boolean {
  const body = document.getElementsByTagName('body').item(0);

  return body?.classList.contains('rtl') || false;
}

export const BlockMenuItem = (): JSX.Element | null => {
  const convoId = useConvoIdFromContext();
  const isMe = useIsMe(convoId);
  const isBlocked = useIsBlocked(convoId);
  const isPrivate = useIsPrivate(convoId);
  const isIncomingRequest = useIsIncomingRequest(convoId);

  if (!isMe && isPrivate && !isIncomingRequest && !PubKey.hasBlindedPrefix(convoId)) {
    const blockTitle = isBlocked ? window.i18n('unblock') : window.i18n('block');
    const blockHandler = isBlocked
      ? () => unblockConvoById(convoId)
      : () => blockConvoById(convoId);
    return <Item onClick={blockHandler}>{blockTitle}</Item>;
  }
  return null;
};

export const ClearNicknameMenuItem = (): JSX.Element | null => {
  const convoId = useConvoIdFromContext();
  const isMe = useIsMe(convoId);
  const hasNickname = useHasNickname(convoId);
  const isPrivate = useIsPrivate(convoId);
  const isPrivateAndFriend = useIsPrivateAndFriend(convoId);

  if (isMe || !hasNickname || !isPrivate || !isPrivateAndFriend) {
    return null;
  }

  return (
    <Item onClick={() => clearNickNameByConvoId(convoId)}>{window.i18n('clearNickname')}</Item>
  );
};

export const ChangeNicknameMenuItem = () => {
  const convoId = useConvoIdFromContext();
  const isMe = useIsMe(convoId);
  const isPrivate = useIsPrivate(convoId);
  const isPrivateAndFriend = useIsPrivateAndFriend(convoId);
  const dispatch = useDispatch();

  if (isMe || !isPrivate || !isPrivateAndFriend) {
    return null;
  }
  return (
    <Item
      onClick={() => {
        dispatch(changeNickNameModal({ conversationId: convoId }));
      }}
    >
      {window.i18n('changeNickname')}
    </Item>
  );
};

/**
 * This menu is always available and can be used to clear the messages in the local database only.
 * No messages are sent, no update are made in the wrappers.
 * Note: Will ask for confirmation before processing.
 */
export const DeleteMessagesMenuItem = () => {
  const convoId = useConvoIdFromContext();

  if (!convoId) {
    return null;
  }
  return (
    <Item
      onClick={() => {
        deleteAllMessagesByConvoIdWithConfirmation(convoId);
      }}
    >
      {window.i18n('deleteMessages')}
    </Item>
  );
};

/**
 * This menu item can be used to delete a private conversation after confirmation.
 * It does not reset the flags of that conversation, but just removes the messages locally and hide it from the left pane list.
 * Note: A dialog is opened to ask for confirmation before processing.
 */
export const DeletePrivateConversationMenuItem = () => {
  const convoId = useConvoIdFromContext();
  const isRequest = useIsIncomingRequest(convoId);
  const isPrivate = useIsPrivate(convoId);

  if (!convoId || !isPrivate || isRequest) {
    return null;
  }

  return (
    <Item
      onClick={async () => {
        await getConversationController().deleteContact(convoId, {
          fromSyncMessage: false,
          justHidePrivate: true,
        });
      }}
    >
      {window.i18n('deleteConversation')}
    </Item>
  );
};

export const AcceptMsgRequestMenuItem = () => {
  const convoId = useConvoIdFromContext();
  const isRequest = useIsIncomingRequest(convoId);
  const convo = getConversationController().get(convoId);
  const isPrivate = useIsPrivate(convoId);

  if (isRequest && isPrivate) {
    return (
      <Item
        onClick={async () => {
          await convo.setDidApproveMe(true);
          await convo.addOutgoingApprovalMessage(Date.now());
          await approveConvoAndSendResponse(convoId, true);
        }}
      >
        {window.i18n('accept')}
      </Item>
    );
  }
  return null;
};

export const DeclineMsgRequestMenuItem = () => {
  const convoId = useConvoIdFromContext();
  const isRequest = useIsIncomingRequest(convoId);
  const isPrivate = useIsPrivate(convoId);
  const selected = useSelectedConversationKey();

  if (isPrivate && isRequest) {
    return (
      <Item
        onClick={() => {
          declineConversationWithConfirm({
            conversationId: convoId,
            syncToDevices: true,
            blockContact: false,
            currentlySelectedConvo: selected || undefined,
          });
        }}
      >
        {window.i18n('decline')}
      </Item>
    );
  }
  return null;
};

export const DeclineAndBlockMsgRequestMenuItem = () => {
  const convoId = useConvoIdFromContext();
  const isRequest = useIsIncomingRequest(convoId);
  const selected = useSelectedConversationKey();
  const isPrivate = useIsPrivate(convoId);

  if (isRequest && isPrivate) {
    return (
      <Item
        onClick={() => {
          declineConversationWithConfirm({
            conversationId: convoId,
            syncToDevices: true,
            blockContact: true,
            currentlySelectedConvo: selected || undefined,
          });
        }}
      >
        {window.i18n('block')}
      </Item>
    );
  }
  return null;
};
