import React from 'react';
import { animation, Menu } from 'react-contexify';
import { ConversationTypeEnum } from '../../../models/conversation';

import {
  getBlockMenuItem,
  getChangeNicknameMenuItem,
  getClearNicknameMenuItem,
  getCopyMenuItem,
  getDeleteContactMenuItem,
  getDeleteMessagesMenuItem,
  getInviteContactMenuItem,
  getLeaveGroupMenuItem,
  getMarkAllReadMenuItem,
} from './Menu';

export type PropsContextConversationItem = {
  triggerId: string;
  type: ConversationTypeEnum;
  isMe: boolean;
  isPublic?: boolean;
  isBlocked?: boolean;
  hasNickname?: boolean;
  isKickedFromGroup?: boolean;
  left?: boolean;

  onDeleteMessages?: () => void;
  onDeleteContact?: () => void;
  onLeaveGroup?: () => void;
  onBlockContact?: () => void;
  onMarkAllRead: () => void;
  onCopyPublicKey?: () => void;
  onUnblockContact?: () => void;
  onInviteContacts?: () => void;
  onClearNickname?: () => void;
  onChangeNickname?: () => void;
};

export const ConversationListItemContextMenu = (props: PropsContextConversationItem) => {
  const {
    triggerId,
    isBlocked,
    isMe,
    isPublic,
    hasNickname,
    type,
    left,
    isKickedFromGroup,
    onDeleteContact,
    onDeleteMessages,
    onBlockContact,
    onClearNickname,
    onCopyPublicKey,
    onMarkAllRead,
    onUnblockContact,
    onInviteContacts,
    onLeaveGroup,
    onChangeNickname,
  } = props;

  const isGroup = type === 'group';

  return (
    <Menu id={triggerId} animation={animation.fade}>
      {getBlockMenuItem(
        isMe,
        type === ConversationTypeEnum.PRIVATE,
        isBlocked,
        onBlockContact,
        onUnblockContact,
        window.i18n
      )}
      {getCopyMenuItem(isPublic, isGroup, onCopyPublicKey, window.i18n)}
      {getMarkAllReadMenuItem(onMarkAllRead, window.i18n)}
      {getChangeNicknameMenuItem(isMe, onChangeNickname, isGroup, window.i18n)}
      {getClearNicknameMenuItem(isMe, hasNickname, onClearNickname, isGroup, window.i18n)}

      {getDeleteMessagesMenuItem(isPublic, onDeleteMessages, window.i18n)}
      {getInviteContactMenuItem(isGroup, isPublic, onInviteContacts, window.i18n)}
      {getDeleteContactMenuItem(
        isMe,
        isGroup,
        isPublic,
        left,
        isKickedFromGroup,
        onDeleteContact,
        window.i18n
      )}
      {getLeaveGroupMenuItem(isKickedFromGroup, left, isGroup, isPublic, onLeaveGroup, window.i18n)}
    </Menu>
  );
};
