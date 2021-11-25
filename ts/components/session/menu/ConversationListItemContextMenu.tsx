import React from 'react';
import { animation, Menu } from 'react-contexify';
import _ from 'underscore';
import { useAvatarPath, useConversationUsername } from '../../../hooks/useParamSelector';
import {
  ConversationNotificationSettingType,
  ConversationTypeEnum,
} from '../../../models/conversation';

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
  getNotificationForConvoMenuItem,
  getPinConversationMenuItem,
  getShowUserDetailsMenuItem,
} from './Menu';

export type PropsContextConversationItem = {
  conversationId: string;
  triggerId: string;
  type: ConversationTypeEnum;
  isMe: boolean;
  isPublic: boolean;
  isPrivate: boolean;
  isBlocked: boolean;
  hasNickname: boolean;
  isKickedFromGroup: boolean;
  left: boolean;
  theme?: any;
  currentNotificationSetting: ConversationNotificationSettingType;
  avatarPath: string | null;
};

const ConversationListItemContextMenu = (props: PropsContextConversationItem) => {
  const {
    conversationId,
    triggerId,
    isBlocked,
    isMe,
    isPublic,
    hasNickname,
    type,
    left,
    isKickedFromGroup,
    currentNotificationSetting,
    isPrivate,
  } = props;

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
