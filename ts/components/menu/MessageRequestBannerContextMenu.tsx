import React from 'react';
import { animation, Menu } from 'react-contexify';
import _ from 'lodash';

import { SessionContextMenuContainer } from '../SessionContextMenuContainer';
import { useDispatch } from 'react-redux';
import { hideMessageRequestBanner } from '../../state/ducks/userConfig';
import { Item } from 'react-contexify';

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
      <Menu id={triggerId} animation={animation.fade}>
        <HideBannerMenuItem />
      </Menu>
    </SessionContextMenuContainer>
  );
};
