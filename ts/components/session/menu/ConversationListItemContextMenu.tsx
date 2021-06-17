import React, { useState } from 'react';
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
  id: string;
  triggerId: string;
  type: ConversationTypeEnum;
  isMe: boolean;
  isPublic?: boolean;
  isBlocked?: boolean;
  hasNickname?: boolean;
  isKickedFromGroup?: boolean;
  left?: boolean;
  theme?: any;

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
    id,
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
    theme,
  } = props;

  const isGroup = type === 'group';

  const [modal, setModal] = useState<any>(null);

  return (
    <>
      {modal ? modal : null}

      <Menu id={triggerId} animation={animation.fade}>
        {getBlockMenuItem(
          isMe,
          type === ConversationTypeEnum.PRIVATE,
          isBlocked,
          onBlockContact,
          onUnblockContact
        )}
        {getCopyMenuItem(isPublic, isGroup, onCopyPublicKey)}
        {getMarkAllReadMenuItem(onMarkAllRead)}
        {getChangeNicknameMenuItem(isMe, onChangeNickname, isGroup, id, setModal)}
        {getClearNicknameMenuItem(isMe, hasNickname, onClearNickname, isGroup)}

        {getDeleteMessagesMenuItem(isPublic, onDeleteMessages, id)}
        {getInviteContactMenuItem(isGroup, isPublic, onInviteContacts)}
        {getDeleteContactMenuItem(
          isMe,
          isGroup,
          isPublic,
          left,
          isKickedFromGroup,
          onDeleteContact,
          id
        )}
        {getLeaveGroupMenuItem(
          isKickedFromGroup,
          left,
          isGroup,
          isPublic,
          onLeaveGroup,
          id,
          setModal
        )}
      </Menu>
    </>
  );
};
