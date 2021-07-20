import React from 'react';
import { animation, Menu } from 'react-contexify';
import _ from 'underscore';
import {
  ConversationNotificationSettingType,
  ConversationTypeEnum,
} from '../../../models/conversation';
import { NotificationForConvoOption } from '../../../state/ducks/conversations';

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
} from './Menu';

export type PropsContextConversationItem = {
  conversationId: string;
  triggerId: string;
  type: ConversationTypeEnum;
  isMe: boolean;
  isPublic: boolean;
  isBlocked: boolean;
  hasNickname: boolean;
  isKickedFromGroup: boolean;
  left: boolean;
  theme?: any;
  notificationForConvo: Array<NotificationForConvoOption>;
  currentNotificationSetting: ConversationNotificationSettingType;
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
    notificationForConvo,
    currentNotificationSetting,
  } = props;

  const isGroup = type === 'group';
  return (
    <Menu id={triggerId} animation={animation.fade}>
      {getNotificationForConvoMenuItem(
        isKickedFromGroup,
        left,
        isBlocked,
        notificationForConvo,
        currentNotificationSetting,
        conversationId
      )}
      {getPinConversationMenuItem(conversationId)}
      {getBlockMenuItem(isMe, type === ConversationTypeEnum.PRIVATE, isBlocked, conversationId)}
      {getCopyMenuItem(isPublic, isGroup, conversationId)}
      {getMarkAllReadMenuItem(conversationId)}
      {getChangeNicknameMenuItem(isMe, isGroup, conversationId)}
      {getClearNicknameMenuItem(isMe, hasNickname, isGroup, conversationId)}
      {getDeleteMessagesMenuItem(isPublic, conversationId)}
      {getInviteContactMenuItem(isGroup, isPublic, conversationId)}
      {getDeleteContactMenuItem(isMe, isGroup, isPublic, left, isKickedFromGroup, conversationId)}
      {getLeaveGroupMenuItem(isKickedFromGroup, left, isGroup, isPublic, conversationId)}
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
