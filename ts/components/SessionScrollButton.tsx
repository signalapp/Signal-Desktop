import React from 'react';
import { useSelector } from 'react-redux';
import styled from 'styled-components';
import { getShowScrollButton } from '../state/selectors/conversations';

import { SessionIconButton } from './icon';

type Props = {
  onClick?: () => any;
};

const SessionScrollButtonDiv = styled.div`
  position: fixed;
  z-index: 2;
  right: 60px;
  animation: fadein var(--default-duration);
`;

export const SessionScrollButton = (props: Props) => {
  const show = useSelector(getShowScrollButton);

  return (
    <SessionScrollButtonDiv>
      <SessionIconButton
        iconType="chevron"
        iconSize={'huge'}
        isHidden={!show}
        onClick={props.onClick}
      />
    </SessionScrollButtonDiv>
  );
};
