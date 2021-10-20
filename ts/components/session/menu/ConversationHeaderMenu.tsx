import React from 'react';
import { animation, Menu } from 'react-contexify';
import {
  getAddModeratorsMenuItem,
  getBlockMenuItem,
  getChangeNicknameMenuItem,
  getClearNicknameMenuItem,
  getCopyMenuItem,
  getDeleteContactMenuItem,
  getDeleteMessagesMenuItem,
  getDisappearingMenuItem,
  getInviteContactMenuItem,
  getLeaveGroupMenuItem,
  getMarkAllReadMenuItem,
  getNotificationForConvoMenuItem,
  getPinConversationMenuItem,
  getRemoveModeratorsMenuItem,
  getShowUserDetailsMenuItem,
  getStartCallMenuItem,
  getUpdateGroupNameMenuItem,
} from './Menu';
import _ from 'lodash';
import { ConversationNotificationSettingType } from '../../../models/conversation';

export type PropsConversationHeaderMenu = {
  conversationId: string;
  triggerId: string;
  isMe: boolean;
  isPublic: boolean;
  isKickedFromGroup: boolean;
  left: boolean;
  isGroup: boolean;
  weAreAdmin: boolean;
  currentNotificationSetting: ConversationNotificationSettingType;
  isPrivate: boolean;
  isBlocked: boolean;
  hasNickname: boolean;
  name: string | undefined;
  profileName: string | undefined;
  avatarPath: string | null;
};

const ConversationHeaderMenu = (props: PropsConversationHeaderMenu) => {
  const {
    conversationId,
    triggerId,
    isMe,
    isPublic,
    isGroup,
    isKickedFromGroup,
    weAreAdmin,
    isBlocked,
    isPrivate,
    left,
    hasNickname,
    currentNotificationSetting,
    name,
    profileName,
    avatarPath,
  } = props;
  const userName = name || profileName || conversationId;

  return (
    <Menu id={triggerId} animation={animation.fade}>
      {getStartCallMenuItem(conversationId)}
      {getDisappearingMenuItem(isPublic, isKickedFromGroup, left, isBlocked, conversationId)}
      {getNotificationForConvoMenuItem({
        isKickedFromGroup,
        left,
        isBlocked,
        isPrivate,
        currentNotificationSetting,
        conversationId,
      })}
      {getPinConversationMenuItem(conversationId)}
      {getBlockMenuItem(isMe, isPrivate, isBlocked, conversationId)}
      {getCopyMenuItem(isPublic, isGroup, conversationId)}
      {getMarkAllReadMenuItem(conversationId)}
      {getChangeNicknameMenuItem(isMe, isGroup, conversationId)}
      {getClearNicknameMenuItem(isMe, hasNickname, isGroup, conversationId)}
      {getDeleteMessagesMenuItem(isPublic, conversationId)}
      {getAddModeratorsMenuItem(weAreAdmin, isPublic, isKickedFromGroup, conversationId)}
      {getRemoveModeratorsMenuItem(weAreAdmin, isPublic, isKickedFromGroup, conversationId)}
      {getUpdateGroupNameMenuItem(weAreAdmin, isKickedFromGroup, left, conversationId)}
      {getLeaveGroupMenuItem(isKickedFromGroup, left, isGroup, isPublic, conversationId)}
      {getInviteContactMenuItem(isGroup, isPublic, conversationId)}
      {getDeleteContactMenuItem(isGroup, isPublic, left, isKickedFromGroup, conversationId)}
      {getShowUserDetailsMenuItem(isPrivate, conversationId, avatarPath, userName)}
    </Menu>
  );
};

function propsAreEqual(prev: PropsConversationHeaderMenu, next: PropsConversationHeaderMenu) {
  return _.isEqual(prev, next);
}
export const MemoConversationHeaderMenu = React.memo(ConversationHeaderMenu, propsAreEqual);
