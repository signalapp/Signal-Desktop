import React, { useContext } from 'react';
import { useSelector } from 'react-redux';
import styled, { ThemeContext } from 'styled-components';
import { getShowScrollButton } from '../../state/selectors/conversations';

import { SessionIconButton, SessionIconSize, SessionIconType } from './icon';

type Props = {
  onClick?: () => any;
};

const SessionScrollButtonDiv = styled.div`
  position: fixed;
  z-index: 2;
  right: 60px;
  animation: fadein ${props => props.theme.common.animations.defaultDuration};
`;

export const SessionScrollButton = (props: Props) => {
  const themeContext = useContext(ThemeContext);

  const show = useSelector(getShowScrollButton);

  return (
    <SessionScrollButtonDiv theme={themeContext}>
      <SessionIconButton
        iconType={SessionIconType.Chevron}
        iconSize={SessionIconSize.Huge}
        isHidden={!show}
        onClick={props.onClick}
        theme={themeContext}
      />
    </SessionScrollButtonDiv>
  );
};
