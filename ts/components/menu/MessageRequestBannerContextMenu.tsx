import React from 'react';
import { Item, Menu } from 'react-contexify';
import { useDispatch } from 'react-redux';

import { SessionContextMenuContainer } from '../SessionContextMenuContainer';

import { hideMessageRequestBanner } from '../../state/ducks/userConfig';

export type PropsContextConversationItem = {
  triggerId: string;
};

const HideBannerMenuItem = (): JSX.Element => {
  const dispatch = useDispatch();
  return (
    <Item
      onClick={() => {
        dispatch(hideMessageRequestBanner());
      }}
    >
      {window.i18n('hideBanner')}
    </Item>
  );
};

export const MessageRequestBannerContextMenu = (props: PropsContextConversationItem) => {
  const { triggerId } = props;

  return (
    <SessionContextMenuContainer>
      <Menu id={triggerId} animation="fade">
        <HideBannerMenuItem />
      </Menu>
    </SessionContextMenuContainer>
  );
};
