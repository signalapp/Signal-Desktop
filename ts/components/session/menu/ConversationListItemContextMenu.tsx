import React from 'react';
import { animation, Menu } from 'react-contexify';
import { ConversationTypeEnum } from '../../../models/conversation';
import { SectionType } from '../ActionsPanel';

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
  MenuItemPinConversation,
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
};

export const ConversationListItemContextMenu = (props: PropsContextConversationItem) => {
  const {
    id: conversationId,
    triggerId,
    isBlocked,
    isMe,
    isPublic,
    hasNickname,
    type,
    left,
    isKickedFromGroup,
  } = props;

  const isGroup = type === 'group';

  const isMessagesSection =
    window.inboxStore?.getState().section.focusedSection === SectionType.Message;
  const pinMenuItem = isMessagesSection ? (
    <MenuItemPinConversation conversationId={conversationId} />
  ) : null;

  return (
    <>
      <Menu id={triggerId} animation={animation.fade}>
        {pinMenuItem}
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
    </>
  );
};
