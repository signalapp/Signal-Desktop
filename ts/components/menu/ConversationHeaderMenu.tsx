import React from 'react';
import { animation, Menu } from 'react-contexify';
import {
  AcceptMenuItem,
  AddModeratorsMenuItem,
  BanMenuItem,
  BlockMenuItem,
  ChangeNicknameMenuItem,
  ClearNicknameMenuItem,
  CopyMenuItem,
  DeclineMenuItem,
  DeleteContactMenuItem,
  DeleteMessagesMenuItem,
  DisappearingMessageMenuItem,
  InviteContactMenuItem,
  LeaveGroupMenuItem,
  MarkAllReadMenuItem,
  NotificationForConvoMenuItem,
  PinConversationMenuItem,
  RemoveModeratorsMenuItem,
  ShowUserDetailsMenuItem,
  UnbanMenuItem,
  UpdateGroupNameMenuItem,
} from './Menu';
import _ from 'lodash';
import { ContextConversationId } from '../leftpane/conversation-list-item/ConversationListItem';
import { getSelectedConversationKey } from '../../state/selectors/conversations';
import { useSelector } from 'react-redux';

export type PropsConversationHeaderMenu = {
  triggerId: string;
};

export const ConversationHeaderMenu = (props: PropsConversationHeaderMenu) => {
  const { triggerId } = props;

  const selectedConversation = useSelector(getSelectedConversationKey);

  if (!selectedConversation) {
    throw new Error('selectedConversation must be set for a header to be visible!');
  }
  return (
    <ContextConversationId.Provider value={selectedConversation}>
      <Menu id={triggerId} animation={animation.fade}>
        <AcceptMenuItem />
        <DeclineMenuItem />
        <DisappearingMessageMenuItem />
        <NotificationForConvoMenuItem />
        <PinConversationMenuItem />
        <BlockMenuItem />
        <CopyMenuItem />
        <MarkAllReadMenuItem />
        <ChangeNicknameMenuItem />
        <ClearNicknameMenuItem />
        <DeleteMessagesMenuItem />
        <AddModeratorsMenuItem />
        <RemoveModeratorsMenuItem />
        <BanMenuItem />
        <UnbanMenuItem />
        <UpdateGroupNameMenuItem />
        <LeaveGroupMenuItem />
        <InviteContactMenuItem />
        <DeleteContactMenuItem />
        <ShowUserDetailsMenuItem />
      </Menu>
    </ContextConversationId.Provider>
  );
};
