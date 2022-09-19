import React from 'react';
import { animation, Menu } from 'react-contexify';
import _ from 'lodash';

import { HideBannerMenuItem } from './Menu';
import { SessionContextMenuContainer } from '../SessionContextMenuContainer';

export type PropsContextConversationItem = {
  triggerId: string;
};

const MessageRequestBannerContextMenu = (props: PropsContextConversationItem) => {
  const { triggerId } = props;

  return (
    // TODO Theming - Waiting on Session Components for correct colors
    <SessionContextMenuContainer>
      <Menu id={triggerId} animation={animation.fade}>
        <HideBannerMenuItem />
      </Menu>
    </SessionContextMenuContainer>
  );
};

function propsAreEqual(prev: PropsContextConversationItem, next: PropsContextConversationItem) {
  return _.isEqual(prev, next);
}
export const MemoMessageRequestBannerContextMenu = React.memo(
  MessageRequestBannerContextMenu,
  propsAreEqual
);
