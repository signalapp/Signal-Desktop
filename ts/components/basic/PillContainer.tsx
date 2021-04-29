import React from 'react';
import styled from 'styled-components';

type PillContainerProps = {
  children: React.ReactNode;
  margin?: string;
  padding?: string;
  onClick?: () => void;
};

const StyledPillContainer = styled.div<PillContainerProps>`
  display: flex;
  background: none;
  flex-direction: 'row';
  flex-grow: 1;
  align-items: center;
  padding: ${props => props.padding || ''};
  margin: ${props => props.margin || ''};
  border-radius: 300px;
  border: 1px solid ${props => props.theme.colors.pillDividerColor};
  transition: ${props => props.theme.common.animations.defaultDuration};
  &:hover {
    background: ${props => props.theme.colors.clickableHovered};
  }
`;

export const PillContainer = (props: PillContainerProps) => {
  return <StyledPillContainer {...props}>{props.children}</StyledPillContainer>;
};
