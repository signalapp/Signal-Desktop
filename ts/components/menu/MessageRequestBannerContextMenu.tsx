import React from 'react';
import { animation, Menu } from 'react-contexify';
import _ from 'lodash';

import { HideBannerMenuItem } from './Menu';

export type PropsContextConversationItem = {
  triggerId: string;
};

const MessageRequestBannerContextMenu = (props: PropsContextConversationItem) => {
  const { triggerId } = props;

  return (
    <Menu id={triggerId} animation={animation.fade}>
      <HideBannerMenuItem />
    </Menu>
  );
};

function propsAreEqual(prev: PropsContextConversationItem, next: PropsContextConversationItem) {
  return _.isEqual(prev, next);
}
export const MemoMessageRequestBannerContextMenu = React.memo(
  MessageRequestBannerContextMenu,
  propsAreEqual
);
