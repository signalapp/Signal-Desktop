import React from 'react';
import { animation, Menu } from 'react-contexify';
import {
  getAddModeratorsMenuItem,
  getBlockMenuItem,
  getCopyMenuItem,
  getDeleteContactMenuItem,
  getDeleteMessagesMenuItem,
  getDisappearingMenuItem,
  getInviteContactMenuItem,
  getLeaveGroupMenuItem,
  getRemoveModeratorsMenuItem,
  getUpdateGroupNameMenuItem,
} from './Menu';
import { TimerOption } from '../../conversation/ConversationHeader';

export type PropsConversationHeaderMenu = {
  triggerId: string;
  isMe: boolean;
  isPublic?: boolean;
  isKickedFromGroup?: boolean;
  left?: boolean;
  isGroup: boolean;
  isAdmin: boolean;
  timerOptions: Array<TimerOption>;
  isPrivate: boolean;
  isBlocked: boolean;
  onDeleteMessages?: () => void;
  onDeleteContact?: () => void;
  onCopyPublicKey?: () => void;
  onInviteContacts?: () => void;

  onLeaveGroup: () => void;
  onAddModerators: () => void;
  onRemoveModerators: () => void;
  onUpdateGroupName: () => void;
  onBlockUser: () => void;
  onUnblockUser: () => void;
  onSetDisappearingMessages: (seconds: number) => void;
};

export const ConversationHeaderMenu = (props: PropsConversationHeaderMenu) => {
  const {
    triggerId,
    isMe,
    isPublic,
    isGroup,
    isKickedFromGroup,
    isAdmin,
    timerOptions,
    isBlocked,
    isPrivate,
    left,

    onDeleteMessages,
    onDeleteContact,
    onCopyPublicKey,
    onLeaveGroup,
    onAddModerators,
    onRemoveModerators,
    onInviteContacts,
    onUpdateGroupName,
    onBlockUser,
    onUnblockUser,
    onSetDisappearingMessages,
  } = props;

  return (
    <Menu id={triggerId} animation={animation.fade}>
      {getDisappearingMenuItem(
        isPublic,
        isKickedFromGroup,
        left,
        isBlocked,
        timerOptions,
        onSetDisappearingMessages,
        window.i18n
      )}
      {getBlockMenuItem(
        isMe,
        isPrivate,
        isBlocked,
        onBlockUser,
        onUnblockUser,
        window.i18n
      )}

      {getCopyMenuItem(isPublic, isGroup, onCopyPublicKey, window.i18n)}
      {getDeleteMessagesMenuItem(isPublic, onDeleteMessages, window.i18n)}
      {getAddModeratorsMenuItem(
        isAdmin,
        isKickedFromGroup,
        onAddModerators,
        window.i18n
      )}
      {getRemoveModeratorsMenuItem(
        isAdmin,
        isKickedFromGroup,
        onRemoveModerators,
        window.i18n
      )}
      {getUpdateGroupNameMenuItem(
        isAdmin,
        isKickedFromGroup,
        left,
        onUpdateGroupName,
        window.i18n
      )}
      {getLeaveGroupMenuItem(
        isKickedFromGroup,
        left,
        isGroup,
        isPublic,
        onLeaveGroup,
        window.i18n
      )}
      {/* TODO: add delete group */}
      {getInviteContactMenuItem(
        isGroup,
        isPublic,
        onInviteContacts,
        window.i18n
      )}
      {getDeleteContactMenuItem(
        isMe,
        isGroup,
        isPublic,
        left,
        onDeleteContact,
        window.i18n
      )}
    </Menu>
  );
};
