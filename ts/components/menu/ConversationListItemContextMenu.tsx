import React from 'react';
import { animation, Menu } from 'react-contexify';
import _ from 'lodash';

import {
  AcceptMsgRequestMenuItem,
  BanMenuItem,
  BlockMenuItem,
  ChangeNicknameMenuItem,
  ClearNicknameMenuItem,
  CopyMenuItem,
  DeclineAndBlockMsgRequestMenuItem,
  DeclineMsgRequestMenuItem,
  DeleteContactMenuItem,
  DeleteMessagesMenuItem,
  InviteContactMenuItem,
  LeaveGroupMenuItem,
  MarkAllReadMenuItem,
  MarkConversationUnreadMenuItem,
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

  return (
    <SessionContextMenuContainer>
      <Menu id={triggerId} animation={animation.fade}>
        <AcceptMsgRequestMenuItem />
        <DeclineMsgRequestMenuItem />
        <DeclineAndBlockMsgRequestMenuItem />
        <PinConversationMenuItem />
        <BlockMenuItem />
        <CopyMenuItem />
        <MarkAllReadMenuItem />
        <MarkConversationUnreadMenuItem />
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
