import React from 'react';
import styled from 'styled-components';

type PillContainerProps = {
  children: React.ReactNode;
  margin?: string;
  padding?: string;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
};

const StyledPillContainer = styled.div<PillContainerProps>`
  display: flex;
  background: none;
  flex-direction: 'row';
  flex-grow: 1;
  flex: 1 1 40%;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  align-items: center;
  padding: ${props => props.padding || ''};
  margin: ${props => props.margin || ''};
  border-radius: 300px;
  cursor: pointer;
  border: 1px solid ${props => props.theme.colors.pillDividerColor};
  transition: ${props => props.theme.common.animations.defaultDuration};
  &:hover {
    background: ${props => props.theme.colors.clickableHovered};
  }
`;

const StyledPillContainerHoverable = styled.div<PillContainerProps>`
  background: none;
  
  position: relative;
  flex-direction: 'row';
  
  width: 50%;
  white-space: nowrap;
  text-overflow: ellipsis;
  align-items: center;
  padding: ${props => props.padding || ''};
  margin: ${props => props.margin || ''};
`;


const StyledPillInner = styled.div<PillContainerProps>`
  background: green;
  background: none;

  display: flex;
  flex-direction: 'row';
  flex-grow: 1;
  flex: 1 1 40%;

  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;

  align-items: center;
  padding: ${props => props.padding || ''};
  margin: ${props => props.margin || ''};
  border-radius: 300px;
  cursor: pointer;
  border: 1px solid ${props => props.theme.colors.pillDividerColor};
  transition: ${props => props.theme.common.animations.defaultDuration};
  &:hover {
    background: ${props => props.theme.colors.clickableHovered};
  }
`;

export const PillContainer = (props: PillContainerProps) => {
  return <StyledPillContainer {...props}>{props.children}</StyledPillContainer>;
};

export const PillTooltipWrapper = (props: PillContainerProps) => {
  return <StyledPillContainerHoverable {...props}>{props.children}</StyledPillContainerHoverable>;
};

export const PillContainerHoverable = (props: PillContainerProps) => {
  return <StyledPillInner {...props}>{props.children}</StyledPillInner>;
};