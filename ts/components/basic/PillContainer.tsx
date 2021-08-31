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
  border: 1px solid var(--color-pill-divider);
  transition: var(--default-duration);
  &:hover {
    background: var(--color-clickable-hovered);
  }
`;

export const PillTooltipWrapper = (props: PillContainerProps) => {
  return <StyledPillContainerHoverable {...props}>{props.children}</StyledPillContainerHoverable>;
};

export const PillContainerHoverable = (props: PillContainerProps) => {
  return <StyledPillInner {...props}>{props.children}</StyledPillInner>;
};
