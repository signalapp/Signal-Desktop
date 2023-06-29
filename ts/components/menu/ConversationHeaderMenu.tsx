import React from 'react';
import { animation, Menu } from 'react-contexify';
import { useSelector } from 'react-redux';
import { isSearching } from '../../state/selectors/search';
import {
  useSelectedConversationKey,
  useSelectedIsPrivate,
  useSelectedIsPrivateFriend,
} from '../../state/selectors/selectedConversation';

import { ContextConversationProvider } from '../leftpane/conversation-list-item/ConvoIdContext';
import { SessionContextMenuContainer } from '../SessionContextMenuContainer';
import {
  AddModeratorsMenuItem,
  BanMenuItem,
  BlockMenuItem,
  ChangeNicknameMenuItem,
  ClearNicknameMenuItem,
  CopyMenuItem,
  DeleteGroupOrCommunityMenuItem,
  DeleteMessagesMenuItem,
  DeletePrivateContactMenuItem,
  DeletePrivateConversationMenuItem,
  InviteContactMenuItem,
  LeaveGroupMenuItem,
  MarkAllReadMenuItem,
  NotificationForConvoMenuItem,
  RemoveModeratorsMenuItem,
  ShowUserDetailsMenuItem,
  UnbanMenuItem,
  UpdateGroupNameMenuItem,
} from './Menu';

export type PropsConversationHeaderMenu = {
  triggerId: string;
};

export const ConversationHeaderMenu = (props: PropsConversationHeaderMenu) => {
  const { triggerId } = props;

  const convoId = useSelectedConversationKey();
  const isPrivateFriend = useSelectedIsPrivateFriend();
  const isPrivate = useSelectedIsPrivate();
  const isSearchingMode = useSelector(isSearching);

  if (!convoId) {
    throw new Error('convoId must be set for a header to be visible!');
  }
  if (isSearchingMode) {
    return null;
  }

  // we do not want the triple dots menu at all if this is not a friend at all
  if (isPrivate && !isPrivateFriend) {
    return null;
  }

  return (
    <ContextConversationProvider value={convoId}>
      <SessionContextMenuContainer>
        <Menu id={triggerId} animation={animation.fade}>
          <NotificationForConvoMenuItem />
          <BlockMenuItem />
          <CopyMenuItem />
          <MarkAllReadMenuItem />
          <ChangeNicknameMenuItem />
          <ClearNicknameMenuItem />
          <AddModeratorsMenuItem />
          <RemoveModeratorsMenuItem />
          <BanMenuItem />
          <UnbanMenuItem />
          <UpdateGroupNameMenuItem />
          <LeaveGroupMenuItem />
          <InviteContactMenuItem />
          <DeleteMessagesMenuItem />
          <DeletePrivateConversationMenuItem />
          <DeletePrivateContactMenuItem />
          <DeleteGroupOrCommunityMenuItem />
          <ShowUserDetailsMenuItem />
        </Menu>
      </SessionContextMenuContainer>
    </ContextConversationProvider>
  );
};
