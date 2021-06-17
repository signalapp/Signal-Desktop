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
  id: string;
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

  onDeleteMessages?: () => void;
  onDeleteContact?: () => void;
  onCopyPublicKey?: () => void;
  onInviteContacts?: () => void;
  onChangeNickname?: () => void;
  onClearNickname?: () => void;

  onLeaveGroup: () => void;
  onMarkAllRead: () => void;
  onAddModerators: () => void;
  onRemoveModerators: () => void;
  onUpdateGroupName: () => void;
  onBlockUser: () => void;
  onUnblockUser: () => void;
  onSetDisappearingMessages: (seconds: number) => void;
  onSetNotificationForConvo: (selected: ConversationNotificationSettingType) => void;
};

export const ConversationHeaderMenu = (props: PropsConversationHeaderMenu) => {
  const {
    id,
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

    onClearNickname,
    onChangeNickname,
    onDeleteMessages,
    onDeleteContact,
    onCopyPublicKey,
    onMarkAllRead,
    onLeaveGroup,
    onAddModerators,
    onRemoveModerators,
    onInviteContacts,
    onUpdateGroupName,
    onBlockUser,
    onUnblockUser,
    onSetDisappearingMessages,
    onSetNotificationForConvo,
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
          onSetDisappearingMessages
        )}
        {getNotificationForConvoMenuItem(
          isKickedFromGroup,
          left,
          isBlocked,
          notificationForConvo,
          currentNotificationSetting,
          onSetNotificationForConvo
        )}
        {getBlockMenuItem(isMe, isPrivate, isBlocked, onBlockUser, onUnblockUser)}

        {getCopyMenuItem(isPublic, isGroup, onCopyPublicKey)}
        {getMarkAllReadMenuItem(onMarkAllRead)}
        {getChangeNicknameMenuItem(isMe, onChangeNickname, isGroup, id, setModal)}
        {getClearNicknameMenuItem(isMe, hasNickname, onClearNickname, isGroup)}
        {getDeleteMessagesMenuItem(isPublic, onDeleteMessages, id)}
        {getAddModeratorsMenuItem(isAdmin, isKickedFromGroup, onAddModerators)}
        {getRemoveModeratorsMenuItem(isAdmin, isKickedFromGroup, onRemoveModerators)}
        {getUpdateGroupNameMenuItem(isAdmin, isKickedFromGroup, left, onUpdateGroupName)}
        {getLeaveGroupMenuItem(
          isKickedFromGroup,
          left,
          isGroup,
          isPublic,
          onLeaveGroup,
          id,
          setModal
        )}
        {/* TODO: add delete group */}
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
      </Menu>
    </>
  );
};
