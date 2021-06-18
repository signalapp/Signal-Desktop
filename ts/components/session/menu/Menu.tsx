import React from 'react';

import { NotificationForConvoOption, TimerOption } from '../../conversation/ConversationHeader';
import { Item, Submenu } from 'react-contexify';
import { ConversationNotificationSettingType } from '../../../models/conversation';
import { SessionNicknameDialog } from '../SessionNicknameDialog';
import { useDispatch } from 'react-redux';
import { updateConfirmModal } from '../../../state/ducks/modalDialog';
import { ConversationController } from '../../../session/conversations';
import { UserUtils } from '../../../session/utils';
import { AdminLeaveClosedGroupDialog } from '../../conversation/AdminLeaveClosedGroupDialog';
import { useTheme } from 'styled-components';
import {
  blockConvoById,
  clearNickNameByConvoId,
  copyPublicKeyByConvoId,
  deleteMessagesByConvoIdWithConfirmation,
  markAllReadByConvoId,
  setDisappearingMessagesByConvoId,
  setNotificationForConvoId,
  showAddModeratorsByConvoId,
  showInviteContactByConvoId,
  showRemoveModeratorsByConvoId,
  showUpdateGroupNameByConvoId,
  unblockConvoById,
} from '../../../interactions/conversationInteractions';

function showTimerOptions(
  isPublic: boolean,
  isKickedFromGroup: boolean,
  left: boolean,
  isBlocked: boolean
): boolean {
  return !isPublic && !left && !isKickedFromGroup && !isBlocked;
}

function showNotificationConvo(
  isKickedFromGroup: boolean,
  left: boolean,
  isBlocked: boolean
): boolean {
  return !left && !isKickedFromGroup && !isBlocked;
}

function showMemberMenu(isPublic: boolean, isGroup: boolean): boolean {
  return !isPublic && isGroup;
}

function showBlock(isMe: boolean, isPrivate: boolean): boolean {
  return !isMe && isPrivate;
}

function showClearNickname(isMe: boolean, hasNickname: boolean, isGroup: boolean): boolean {
  return !isMe && hasNickname && !isGroup;
}

function showChangeNickname(isMe: boolean, isGroup: boolean) {
  return !isMe && !isGroup;
}

function showDeleteMessages(isPublic: boolean): boolean {
  return !isPublic;
}

// we want to show the copyId for open groups and private chats only
function showCopyId(isPublic: boolean, isGroup: boolean): boolean {
  return !isGroup || isPublic;
}

function showDeleteContact(
  isMe: boolean,
  isGroup: boolean,
  isPublic: boolean,
  isGroupLeft: boolean,
  isKickedFromGroup: boolean
): boolean {
  // you need to have left a closed group first to be able to delete it completely.
  return (!isMe && !isGroup) || (isGroup && (isGroupLeft || isKickedFromGroup || isPublic));
}

function showAddModerators(isAdmin: boolean, isKickedFromGroup: boolean): boolean {
  return !isKickedFromGroup && isAdmin;
}

function showRemoveModerators(isAdmin: boolean, isKickedFromGroup: boolean): boolean {
  return !isKickedFromGroup && isAdmin;
}

function showUpdateGroupName(isAdmin: boolean, isKickedFromGroup: boolean, left: boolean): boolean {
  return !isKickedFromGroup && !left && isAdmin;
}

function showLeaveGroup(
  isKickedFromGroup: boolean,
  left: boolean,
  isGroup: boolean,
  isPublic: boolean
): boolean {
  return !isKickedFromGroup && !left && isGroup && !isPublic;
}

function showInviteContact(isGroup: boolean, isPublic: boolean): boolean {
  return isGroup && isPublic;
}

/** Menu items standardized */

export function getInviteContactMenuItem(
  isGroup: boolean | undefined,
  isPublic: boolean | undefined,
  conversationId: string
): JSX.Element | null {
  if (showInviteContact(Boolean(isGroup), Boolean(isPublic))) {
    return (
      <Item
        onClick={() => {
          showInviteContactByConvoId(conversationId);
        }}
      >
        {window.i18n('inviteContacts')}
      </Item>
    );
  }
  return null;
}

export function getDeleteContactMenuItem(
  isMe: boolean | undefined,
  isGroup: boolean | undefined,
  isPublic: boolean | undefined,
  isLeft: boolean | undefined,
  isKickedFromGroup: boolean | undefined,
  conversationId: string
): JSX.Element | null {
  if (
    showDeleteContact(
      Boolean(isMe),
      Boolean(isGroup),
      Boolean(isPublic),
      Boolean(isLeft),
      Boolean(isKickedFromGroup)
    )
  ) {
    let menuItemText: string;
    if (isPublic) {
      menuItemText = window.i18n('leaveGroup');
    } else {
      menuItemText = window.i18n('delete');
    }

    const dispatch = useDispatch();
    const onClickClose = () => {
      dispatch(updateConfirmModal(null));
    };

    const showConfirmationModal = () => {
      dispatch(
        updateConfirmModal({
          title: menuItemText,
          message: isGroup
            ? window.i18n('leaveGroupConfirmation')
            : window.i18n('deleteContactConfirmation'),
          onClickClose,
          onClickOk: () => {
            void ConversationController.getInstance().deleteContact(conversationId);
            onClickClose();
          },
        })
      );
    };

    return <Item onClick={showConfirmationModal}>{menuItemText}</Item>;
  }
  return null;
}

export function getLeaveGroupMenuItem(
  isKickedFromGroup: boolean | undefined,
  left: boolean | undefined,
  isGroup: boolean | undefined,
  isPublic: boolean | undefined,
  conversationId: string,
  setModal: any
): JSX.Element | null {
  if (
    showLeaveGroup(Boolean(isKickedFromGroup), Boolean(left), Boolean(isGroup), Boolean(isPublic))
  ) {
    const dispatch = useDispatch();
    const theme = useTheme();
    const conversation = ConversationController.getInstance().get(conversationId);

    const onClickClose = () => {
      dispatch(updateConfirmModal(null));
    };

    const openConfirmationModal = () => {
      if (!conversation.isGroup()) {
        throw new Error('showLeaveGroupDialog() called with a non group convo.');
      }

      const title = window.i18n('leaveGroup');
      const message = window.i18n('leaveGroupConfirmation');
      const ourPK = UserUtils.getOurPubKeyStrFromCache();
      const isAdmin = (conversation.get('groupAdmins') || []).includes(ourPK);
      const isClosedGroup = conversation.get('is_medium_group') || false;

      // if this is not a closed group, or we are not admin, we can just show a confirmation dialog
      if (!isClosedGroup || (isClosedGroup && !isAdmin)) {
        dispatch(
          updateConfirmModal({
            title,
            message,
            onClickOk: () => {
              void conversation.leaveClosedGroup();
              onClickClose();
            },
            onClickClose,
          })
        );
      } else {
        setModal(
          <AdminLeaveClosedGroupDialog
            groupName={conversation.getName()}
            onSubmit={conversation.leaveClosedGroup}
            onClose={() => {
              setModal(null);
            }}
            theme={theme}
          />
        );
      }
    };

    return <Item onClick={openConfirmationModal}>{window.i18n('leaveGroup')}</Item>;
  }
  return null;
}

export function getUpdateGroupNameMenuItem(
  isAdmin: boolean | undefined,
  isKickedFromGroup: boolean | undefined,
  left: boolean | undefined,
  conversationId: string
): JSX.Element | null {
  if (showUpdateGroupName(Boolean(isAdmin), Boolean(isKickedFromGroup), Boolean(left))) {
    return (
      <Item
        onClick={async () => {
          await showUpdateGroupNameByConvoId(conversationId);
        }}
      >
        {window.i18n('editGroup')}
      </Item>
    );
  }
  return null;
}

export function getRemoveModeratorsMenuItem(
  isAdmin: boolean | undefined,
  isKickedFromGroup: boolean | undefined,
  conversationId: string
): JSX.Element | null {
  if (showRemoveModerators(Boolean(isAdmin), Boolean(isKickedFromGroup))) {
    return (
      <Item
        onClick={() => {
          showRemoveModeratorsByConvoId(conversationId);
        }}
      >
        {window.i18n('removeModerators')}
      </Item>
    );
  }
  return null;
}

export function getAddModeratorsMenuItem(
  isAdmin: boolean | undefined,
  isKickedFromGroup: boolean | undefined,
  conversationId: string
): JSX.Element | null {
  if (showAddModerators(Boolean(isAdmin), Boolean(isKickedFromGroup))) {
    return (
      <Item
        onClick={() => {
          showAddModeratorsByConvoId(conversationId);
        }}
      >
        {window.i18n('addModerators')}
      </Item>
    );
  }
  return null;
}

export function getCopyMenuItem(
  isPublic: boolean | undefined,
  isGroup: boolean | undefined,
  conversationId: string
): JSX.Element | null {
  if (showCopyId(Boolean(isPublic), Boolean(isGroup))) {
    const copyIdLabel = isPublic ? window.i18n('copyOpenGroupURL') : window.i18n('copySessionID');
    return <Item onClick={() => copyPublicKeyByConvoId(conversationId)}>{copyIdLabel}</Item>;
  }
  return null;
}

export function getMarkAllReadMenuItem(conversationId: string): JSX.Element | null {
  return (
    <Item onClick={() => markAllReadByConvoId(conversationId)}>{window.i18n('markAllAsRead')}</Item>
  );
}

export function getDisappearingMenuItem(
  isPublic: boolean | undefined,
  isKickedFromGroup: boolean | undefined,
  left: boolean | undefined,
  isBlocked: boolean | undefined,
  timerOptions: Array<TimerOption>,
  conversationId: string
): JSX.Element | null {
  if (
    showTimerOptions(
      Boolean(isPublic),
      Boolean(isKickedFromGroup),
      Boolean(left),
      Boolean(isBlocked)
    )
  ) {
    const isRtlMode = isRtlBody();

    return (
      // Remove the && false to make context menu work with RTL support
      <Submenu
        label={window.i18n('disappearingMessages') as any}
        // rtl={isRtlMode && false}
      >
        {(timerOptions || []).map(item => (
          <Item
            key={item.value}
            onClick={async () => {
              await setDisappearingMessagesByConvoId(conversationId, item.value);
            }}
          >
            {item.name}
          </Item>
        ))}
      </Submenu>
    );
  }
  return null;
}

export function getNotificationForConvoMenuItem(
  isKickedFromGroup: boolean | undefined,
  left: boolean | undefined,
  isBlocked: boolean | undefined,
  notificationForConvoOptions: Array<NotificationForConvoOption>,
  currentNotificationSetting: ConversationNotificationSettingType,
  conversationId: string
): JSX.Element | null {
  if (showNotificationConvo(Boolean(isKickedFromGroup), Boolean(left), Boolean(isBlocked))) {
    // const isRtlMode = isRtlBody();'

    return (
      // Remove the && false to make context menu work with RTL support
      <Submenu
        label={window.i18n('notificationForConvo') as any}
        // rtl={isRtlMode && false}
      >
        {(notificationForConvoOptions || []).map(item => {
          const disabled = item.value === currentNotificationSetting;

          return (
            <Item
              key={item.value}
              onClick={async () => {
                await setNotificationForConvoId(conversationId, item.value);
              }}
              disabled={disabled}
            >
              {item.name}
            </Item>
          );
        })}
      </Submenu>
    );
  }
  return null;
}

export function isRtlBody(): boolean {
  return ($('body') as any).hasClass('rtl');
}

export function getBlockMenuItem(
  isMe: boolean | undefined,
  isPrivate: boolean | undefined,
  isBlocked: boolean | undefined,
  conversationId: string
): JSX.Element | null {
  if (showBlock(Boolean(isMe), Boolean(isPrivate))) {
    const blockTitle = isBlocked ? window.i18n('unblockUser') : window.i18n('blockUser');
    const blockHandler = isBlocked
      ? () => unblockConvoById(conversationId)
      : () => blockConvoById(conversationId);
    return <Item onClick={blockHandler}>{blockTitle}</Item>;
  }
  return null;
}

export function getClearNicknameMenuItem(
  isMe: boolean | undefined,
  hasNickname: boolean | undefined,
  isGroup: boolean | undefined,
  conversationId: string
): JSX.Element | null {
  if (showClearNickname(Boolean(isMe), Boolean(hasNickname), Boolean(isGroup))) {
    return (
      <Item onClick={() => clearNickNameByConvoId(conversationId)}>
        {window.i18n('clearNickname')}
      </Item>
    );
  }
  return null;
}

export function getChangeNicknameMenuItem(
  isMe: boolean | undefined,
  isGroup: boolean | undefined,
  conversationId?: string,
  setModal?: any
): JSX.Element | null {
  if (showChangeNickname(Boolean(isMe), Boolean(isGroup))) {
    const clearModal = () => {
      setModal(null);
    };

    const onClickCustom = () => {
      setModal(<SessionNicknameDialog onClickClose={clearModal} conversationId={conversationId} />);
    };

    return (
      <>
        <Item onClick={onClickCustom}>{window.i18n('changeNickname')}</Item>
      </>
    );
  }
  return null;
}

export function getDeleteMessagesMenuItem(
  isPublic: boolean | undefined,
  conversationId: string
): JSX.Element | null {
  if (showDeleteMessages(Boolean(isPublic))) {
    return (
      <Item
        onClick={() => {
          deleteMessagesByConvoIdWithConfirmation(conversationId);
        }}
      >
        {window.i18n('deleteMessages')}
      </Item>
    );
  }
  return null;
}
