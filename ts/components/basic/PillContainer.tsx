import { ReactNode } from 'react';
import styled from 'styled-components';
import { Flex } from './Flex';

type PillContainerProps = {
  children: ReactNode;
  margin?: string;
  padding?: string;
  onClick?: () => void;
  disableHover?: boolean;
};

export const StyledPillContainerHoverable = styled(Flex)<PillContainerProps>`
  background: none;
  position: relative;
  white-space: nowrap;
  text-overflow: ellipsis;
  align-items: center;
`;

const StyledPillInner = styled.div<PillContainerProps>`
  background: none;
  width: 100%;

  display: flex;
  flex-direction: 'row';
  justify-content: flex-start;
  align-items: center;
  flex-grow: 1;
  flex-shrink: 0;

  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;

  padding: ${props => props.padding || ''};
  margin: ${props => props.margin || ''};
  border-radius: 300px;
  cursor: ${props => (props.disableHover ? 'unset' : 'pointer')};
  border: 1px solid var(--border-color);
  transition: var(--default-duration);
  &:hover {
    background: ${props =>
      props.disableHover ? 'none' : 'var(--button-solid-background-hover-color)'};
  }
`;

export const PillContainerHoverable = (props: Omit<PillContainerProps, 'disableHover'>) => {
  return (
    <StyledPillInner {...props} disableHover={!props.onClick}>
      {props.children}
    </StyledPillInner>
  );
};
