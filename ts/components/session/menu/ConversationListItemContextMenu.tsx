import React from 'react';
import { animation, Menu } from 'react-contexify';

import {
  getBlockMenuItem,
  getClearNicknameMenuItem,
  getCopyMenuItem,
  getDeleteContactMenuItem,
  getDeleteMessagesMenuItem,
  getInviteContactMenuItem,
  getLeaveGroupMenuItem,
} from './Menu';

export type PropsContextConversationItem = {
  triggerId: string;
  type: 'group' | 'direct';
  isMe: boolean;
  isPublic?: boolean;
  isRss?: boolean;
  isClosable?: boolean;
  isBlocked?: boolean;
  hasNickname?: boolean;
  isKickedFromGroup?: boolean;

  onDeleteMessages?: () => void;
  onDeleteContact?: () => void;
  onLeaveGroup?: () => void;
  onBlockContact?: () => void;
  onCopyPublicKey?: () => void;
  onUnblockContact?: () => void;
  onInviteContacts?: () => void;
  onClearNickname?: () => void;
};

export const ConversationListItemContextMenu = (
  props: PropsContextConversationItem
) => {
  const {
    triggerId,
    isBlocked,
    isMe,
    isClosable,
    isRss,
    isPublic,
    hasNickname,
    type,
    isKickedFromGroup,
    onDeleteContact,
    onDeleteMessages,
    onBlockContact,
    onClearNickname,
    onCopyPublicKey,
    onUnblockContact,
    onInviteContacts,
    onLeaveGroup,
  } = props;

  return (
    <Menu id={triggerId} animation={animation.fade}>
      {getBlockMenuItem(
        isMe,
        type === 'direct',
        isBlocked,
        onBlockContact,
        onUnblockContact,
        window.i18n
      )}
      {/* {!isPublic && !isRss && !isMe ? (
        <Item onClick={onChangeNickname}>
          {i18n('changeNickname')}
        </Item>
      ) : null} */}
      {getClearNicknameMenuItem(
        isPublic,
        isRss,
        isMe,
        hasNickname,
        onClearNickname,
        window.i18n
      )}
      {getCopyMenuItem(
        isPublic,
        isRss,
        type === 'group',
        onCopyPublicKey,
        window.i18n
      )}
      {getDeleteMessagesMenuItem(isPublic, onDeleteMessages, window.i18n)}
      {getInviteContactMenuItem(
        type === 'group',
        isPublic,
        onInviteContacts,
        window.i18n
      )}
      {getDeleteContactMenuItem(
        isMe,
        isClosable,
        type === 'group',
        isPublic,
        isRss,
        onDeleteContact,
        window.i18n
      )}
      {getLeaveGroupMenuItem(
        isKickedFromGroup,
        type === 'group',
        isPublic,
        isRss,
        onLeaveGroup,
        window.i18n
      )}
    </Menu>
  );
};
