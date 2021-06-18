import React, { useState } from 'react';
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
  getRemoveModeratorsMenuItem,
  getUpdateGroupNameMenuItem,
} from './Menu';
import { NotificationForConvoOption, TimerOption } from '../../conversation/ConversationHeader';
import { ConversationNotificationSettingType } from '../../../models/conversation';

export type PropsConversationHeaderMenu = {
  conversationId: string;
  triggerId: string;
  isMe: boolean;
  isPublic?: boolean;
  isKickedFromGroup?: boolean;
  left?: boolean;
  isGroup: boolean;
  isAdmin: boolean;
  timerOptions: Array<TimerOption>;
  notificationForConvo: Array<NotificationForConvoOption>;
  currentNotificationSetting: ConversationNotificationSettingType;
  isPrivate: boolean;
  isBlocked: boolean;
  theme: any;
  hasNickname?: boolean;
};

export const ConversationHeaderMenu = (props: PropsConversationHeaderMenu) => {
  const {
    conversationId,
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
    hasNickname,
    notificationForConvo,
    currentNotificationSetting,
  } = props;

  const [modal, setModal] = useState<any>(null);

  return (
    <>
      {modal ? modal : null}

      <Menu id={triggerId} animation={animation.fade}>
        {getDisappearingMenuItem(
          isPublic,
          isKickedFromGroup,
          left,
          isBlocked,
          timerOptions,
          conversationId
        )}
        {getNotificationForConvoMenuItem(
          isKickedFromGroup,
          left,
          isBlocked,
          notificationForConvo,
          currentNotificationSetting,
          conversationId
        )}
        {getBlockMenuItem(isMe, isPrivate, isBlocked, conversationId)}

        {getCopyMenuItem(isPublic, isGroup, conversationId)}
        {getMarkAllReadMenuItem(conversationId)}
        {getChangeNicknameMenuItem(isMe, isGroup, conversationId, setModal)}
        {getClearNicknameMenuItem(isMe, hasNickname, isGroup, conversationId)}
        {getDeleteMessagesMenuItem(isPublic, conversationId)}
        {getAddModeratorsMenuItem(isAdmin, isKickedFromGroup, conversationId)}
        {getRemoveModeratorsMenuItem(isAdmin, isKickedFromGroup, conversationId)}
        {getUpdateGroupNameMenuItem(isAdmin, isKickedFromGroup, left, conversationId)}
        {getLeaveGroupMenuItem(
          isKickedFromGroup,
          left,
          isGroup,
          isPublic,
          conversationId,
          setModal
        )}
        {/* TODO: add delete group */}
        {getInviteContactMenuItem(isGroup, isPublic, conversationId)}
        {getDeleteContactMenuItem(isMe, isGroup, isPublic, left, isKickedFromGroup, conversationId)}
      </Menu>
    </>
  );
};
