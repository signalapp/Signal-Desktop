import React from 'react';
import { Item, Menu, Submenu } from 'react-contexify';
import { useSelector } from 'react-redux';
import { setDisappearingMessagesByConvoId } from '../../interactions/conversationInteractions';
import { isSearching } from '../../state/selectors/search';
import {
  useSelectedConversationKey,
  useSelectedIsActive,
  useSelectedIsBlocked,
  useSelectedIsKickedFromGroup,
  useSelectedIsLeft,
  useSelectedIsPrivate,
  useSelectedIsPrivateFriend,
  useSelectedIsPublic,
} from '../../state/selectors/selectedConversation';
import { getTimerOptions } from '../../state/selectors/timerOptions';
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
        <Menu id={triggerId} animation="fade">
          <DisappearingMessageMenuItem />
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

/**
 * Only accessible through the triple dots menu on the conversation header. Not on the Conversation list item, because there is too much to check for before showing it
 */
const DisappearingMessageMenuItem = (): JSX.Element | null => {
  const selectedConvoId = useSelectedConversationKey();
  const isBlocked = useSelectedIsBlocked();
  const isActive = useSelectedIsActive();
  const isPublic = useSelectedIsPublic();
  const isLeft = useSelectedIsLeft();
  const isKickedFromGroup = useSelectedIsKickedFromGroup();
  const timerOptions = useSelector(getTimerOptions).timerOptions;
  const isFriend = useSelectedIsPrivateFriend();
  const isPrivate = useSelectedIsPrivate();

  if (
    !selectedConvoId ||
    isPublic ||
    isLeft ||
    isKickedFromGroup ||
    isBlocked ||
    !isActive ||
    (isPrivate && !isFriend)
  ) {
    return null;
  }

  // const isRtlMode = isRtlBody();

  return (
    // Remove the && false to make context menu work with RTL support
    <Submenu
      label={window.i18n('disappearingMessages')}
      // rtl={isRtlMode && false}
    >
      {timerOptions.map(item => (
        <Item
          key={item.value}
          onClick={() => {
            void setDisappearingMessagesByConvoId(selectedConvoId, item.value);
          }}
        >
          {item.name}
        </Item>
      ))}
    </Submenu>
  );
};
