import React, { useContext } from 'react';
import { animation, Menu } from 'react-contexify';
import _ from 'underscore';
import {
  useAvatarPath,
  useConversationPropsById,
  useConversationUsername,
} from '../../hooks/useParamSelector';
import { ConversationTypeEnum } from '../../models/conversation';
import { ContextConversationId } from '../leftpane/conversation-list-item/ConversationListItem';

import {
  getBanMenuItem,
  getBlockMenuItem,
  getChangeNicknameMenuItem,
  getClearNicknameMenuItem,
  getCopyMenuItem,
  getDeleteContactMenuItem,
  getDeleteMessagesMenuItem,
  getInviteContactMenuItem,
  getLeaveGroupMenuItem,
  getMarkAllReadMenuItem,
  getNotificationForConvoMenuItem,
  getPinConversationMenuItem,
  getShowUserDetailsMenuItem,
  getUnbanMenuItem,
} from './Menu';

export type PropsContextConversationItem = {
  triggerId: string;
};

const ConversationListItemContextMenu = (props: PropsContextConversationItem) => {
  const conversationId = useContext(ContextConversationId);

  const itemMenuProps = useConversationPropsById(conversationId);
  const { triggerId } = props;
  if (!itemMenuProps) {
    return null;
  }
  const {
    isBlocked,
    isMe,
    isPublic,
    hasNickname,
    type,
    left,
    isKickedFromGroup,
    currentNotificationSetting,
    isPrivate,
    weAreAdmin,
  } = itemMenuProps;

  const isGroup = type === 'group';

  const userName = useConversationUsername(conversationId);
  const avatarPath = useAvatarPath(conversationId);

  return (
    <Menu id={triggerId} animation={animation.fade}>
      {getNotificationForConvoMenuItem({
        isPrivate,
        isKickedFromGroup,
        left,
        isBlocked,
        currentNotificationSetting,
        conversationId,
      })}
      {getPinConversationMenuItem(conversationId)}
      {getBlockMenuItem(isMe, type === ConversationTypeEnum.PRIVATE, isBlocked, conversationId)}
      {getCopyMenuItem(isPublic, isGroup, conversationId)}
      {getMarkAllReadMenuItem(conversationId)}
      {getChangeNicknameMenuItem(isMe, isGroup, conversationId)}
      {getClearNicknameMenuItem(isMe, hasNickname, isGroup, conversationId)}
      {getDeleteMessagesMenuItem(conversationId)}
      {getBanMenuItem(weAreAdmin, isPublic, isKickedFromGroup, conversationId)}
      {getUnbanMenuItem(weAreAdmin, isPublic, isKickedFromGroup, conversationId)}
      {getInviteContactMenuItem(isGroup, isPublic, conversationId)}
      {getDeleteContactMenuItem(isGroup, isPublic, left, isKickedFromGroup, conversationId)}
      {getLeaveGroupMenuItem(isKickedFromGroup, left, isGroup, isPublic, conversationId)}
      {getShowUserDetailsMenuItem(isPrivate, conversationId, avatarPath, userName || '')}
    </Menu>
  );
};

function propsAreEqual(prev: PropsContextConversationItem, next: PropsContextConversationItem) {
  return _.isEqual(prev, next);
}
export const MemoConversationListItemContextMenu = React.memo(
  ConversationListItemContextMenu,
  propsAreEqual
);
