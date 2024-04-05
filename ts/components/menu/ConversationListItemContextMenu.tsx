import React from 'react';
import { Item, Menu } from 'react-contexify';

import { useSelector } from 'react-redux';
import { useConvoIdFromContext } from '../../contexts/ConvoIdContext';
import { useIsPinned, useIsPrivate, useIsPrivateAndFriend } from '../../hooks/useParamSelector';
import { getConversationController } from '../../session/conversations';
import { isSearching } from '../../state/selectors/search';
import { getIsMessageSection } from '../../state/selectors/section';
import { SessionContextMenuContainer } from '../SessionContextMenuContainer';
import {
  AcceptMsgRequestMenuItem,
  BanMenuItem,
  BlockMenuItem,
  ChangeNicknameMenuItem,
  ClearNicknameMenuItem,
  CopyMenuItem,
  DeclineAndBlockMsgRequestMenuItem,
  DeclineMsgRequestMenuItem,
  DeleteMessagesMenuItem,
  DeletePrivateConversationMenuItem,
  InviteContactMenuItem,
  LeaveGroupOrCommunityMenuItem,
  MarkAllReadMenuItem,
  MarkConversationUnreadMenuItem,
  NotificationForConvoMenuItem,
  ShowUserDetailsMenuItem,
  UnbanMenuItem,
} from './Menu';

export type PropsContextConversationItem = {
  triggerId: string;
};

const ConversationListItemContextMenu = (props: PropsContextConversationItem) => {
  const { triggerId } = props;
  const isSearchingMode = useSelector(isSearching);

  if (isSearchingMode) {
    return null;
  }

  return (
    <SessionContextMenuContainer>
      <Menu id={triggerId} animation="fade">
        {/* Message request related actions */}
        <AcceptMsgRequestMenuItem />
        <DeclineMsgRequestMenuItem />
        <DeclineAndBlockMsgRequestMenuItem />
        {/* Generic actions */}
        <PinConversationMenuItem />
        <NotificationForConvoMenuItem />

        <BlockMenuItem />
        <CopyMenuItem />
        {/* Read state actions */}
        <MarkAllReadMenuItem />
        <MarkConversationUnreadMenuItem />
        {/* Nickname actions */}
        <ChangeNicknameMenuItem />
        <ClearNicknameMenuItem />
        {/* Communities actions */}
        <BanMenuItem />
        <UnbanMenuItem />
        <InviteContactMenuItem />
        <DeleteMessagesMenuItem />
        <DeletePrivateConversationMenuItem />
        <LeaveGroupOrCommunityMenuItem />
        <ShowUserDetailsMenuItem />
      </Menu>
    </SessionContextMenuContainer>
  );
};

export const MemoConversationListItemContextMenu = ConversationListItemContextMenu;

export const PinConversationMenuItem = (): JSX.Element | null => {
  const conversationId = useConvoIdFromContext();
  const isMessagesSection = useSelector(getIsMessageSection);
  const isPrivateAndFriend = useIsPrivateAndFriend(conversationId);
  const isPrivate = useIsPrivate(conversationId);
  const isPinned = useIsPinned(conversationId);

  if (isMessagesSection && (!isPrivate || (isPrivate && isPrivateAndFriend))) {
    const conversation = getConversationController().get(conversationId);

    const togglePinConversation = () => {
      void conversation?.togglePinned();
    };

    const menuText = isPinned ? window.i18n('unpinConversation') : window.i18n('pinConversation');
    return <Item onClick={togglePinConversation}>{menuText}</Item>;
  }
  return null;
};
