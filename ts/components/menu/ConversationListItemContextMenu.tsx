import React from 'react';
import { animation, Menu } from 'react-contexify';
import _ from 'lodash';

import {
  AcceptMenuItem,
  BanMenuItem,
  BlockMenuItem,
  ChangeNicknameMenuItem,
  ClearNicknameMenuItem,
  CopyMenuItem,
  DeclineMenuItem,
  DeleteContactMenuItem,
  DeleteMessagesMenuItem,
  InviteContactMenuItem,
  LeaveGroupMenuItem,
  MarkAllReadMenuItem,
  NotificationForConvoMenuItem,
  PinConversationMenuItem,
  ShowUserDetailsMenuItem,
  UnbanMenuItem,
} from './Menu';
import { SessionContextMenuContainer } from '../SessionContextMenuContainer';

export type PropsContextConversationItem = {
  triggerId: string;
};

const ConversationListItemContextMenu = (props: PropsContextConversationItem) => {
  const { triggerId } = props;

  // TODO Theming - Waiting on Session Components for correct colors
  return (
    <SessionContextMenuContainer>
      <Menu id={triggerId} animation={animation.fade}>
        <AcceptMenuItem />
        <DeclineMenuItem />
        <NotificationForConvoMenuItem />
        <PinConversationMenuItem />
        <BlockMenuItem />
        <CopyMenuItem />
        <MarkAllReadMenuItem />
        <ChangeNicknameMenuItem />
        <ClearNicknameMenuItem />
        <DeleteMessagesMenuItem />
        <BanMenuItem />
        <UnbanMenuItem />
        <InviteContactMenuItem />
        <DeleteContactMenuItem />
        <LeaveGroupMenuItem />
        <ShowUserDetailsMenuItem />
      </Menu>
    </SessionContextMenuContainer>
  );
};

function propsAreEqual(prev: PropsContextConversationItem, next: PropsContextConversationItem) {
  return _.isEqual(prev, next);
}
export const MemoConversationListItemContextMenu = React.memo(
  ConversationListItemContextMenu,
  propsAreEqual
);
