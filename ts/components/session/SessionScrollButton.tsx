import React, { useContext } from 'react';
import styled, { ThemeContext } from 'styled-components';

import { SessionIconButton, SessionIconSize, SessionIconType } from './icon';

type Props = {
  onClick?: () => any;
  show?: boolean;
};

const SessionScrollButtonDiv = styled.div`
  position: fixed;
  z-index: 2;
  right: 60px;
  animation: fadein ${props => props.theme.common.animations.defaultDuration};
`;

export const SessionScrollButton = (props: Props) => {
  const themeContext = useContext(ThemeContext);

  return (
    <>
      {props.show && (
        <SessionScrollButtonDiv theme={themeContext}>
          <SessionIconButton
            iconType={SessionIconType.Chevron}
            iconSize={SessionIconSize.Huge}
            onClick={props.onClick}
            theme={themeContext}
          />
        </SessionScrollButtonDiv>
      )}
    </>
  );
};
