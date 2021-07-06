import React from 'react';

import { getNumberOfPinnedConversations } from '../../../state/selectors/conversations';
import { conversationPinned, conversationUnpinned } from '../../../state/ducks/conversations';
import { NotificationForConvoOption, TimerOption } from '../../conversation/ConversationHeader';
import { Item, Submenu } from 'react-contexify';
import { ConversationNotificationSettingType } from '../../../models/conversation';
import { useDispatch, useSelector } from 'react-redux';
import { changeNickNameModal, updateConfirmModal } from '../../../state/ducks/modalDialog';
import { getConversationController } from '../../../session/conversations';
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
  showLeaveGroupByConvoId,
  showRemoveModeratorsByConvoId,
  showUpdateGroupNameByConvoId,
  unblockConvoById,
} from '../../../interactions/conversationInteractions';
import { SessionButtonColor } from '../SessionButton';
import { ToastUtils } from '../../../session/utils';

const maxNumberOfPinnedConversations = 5;

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

export interface PinConversationMenuItemProps {
  conversationId: string;
}

export const MenuItemPinConversation = (
  props: PinConversationMenuItemProps
): JSX.Element | null => {
  const { conversationId } = props;
  const conversation = getConversationController().get(conversationId);
  const isPinned = conversation.getIsPinned();
  const dispatch = useDispatch();
  const nbOfAlreadyPinnedConvos = useSelector(getNumberOfPinnedConversations);

  const togglePinConversation = async () => {
    if (!isPinned && nbOfAlreadyPinnedConvos < maxNumberOfPinnedConversations) {
      await conversation.setIsPinned(!isPinned);
      dispatch(conversationPinned());
    } else if (isPinned) {
      await conversation.setIsPinned(!isPinned);
      dispatch(conversationUnpinned());
    } else {
      ToastUtils.pushToastWarning(
        'setPasswordSuccessToast',
        window.i18n('removePasswordTitle'),
        window.i18n('removePasswordToastDescription')
      );
    }
  };

  const menuText = isPinned ? window.i18n('unpinConversation') : window.i18n('pinConversation');
  return <Item onClick={togglePinConversation}>{menuText}</Item>;
};

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
          okTheme: SessionButtonColor.Danger,
          onClickOk: async () => {
            await getConversationController().deleteContact(conversationId);
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
  conversationId: string
): JSX.Element | null {
  if (
    showLeaveGroup(Boolean(isKickedFromGroup), Boolean(left), Boolean(isGroup), Boolean(isPublic))
  ) {
    return (
      <Item
        onClick={() => {
          showLeaveGroupByConvoId(conversationId);
        }}
      >
        {window.i18n('leaveGroup')}
      </Item>
    );
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
  conversationId: string
): JSX.Element | null {
  const dispatch = useDispatch();
  if (showChangeNickname(Boolean(isMe), Boolean(isGroup))) {
    return (
      <Item
        onClick={() => {
          dispatch(changeNickNameModal({ conversationId }));
        }}
      >
        {window.i18n('changeNickname')}
      </Item>
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
