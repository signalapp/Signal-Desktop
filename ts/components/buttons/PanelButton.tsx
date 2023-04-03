import React, { ReactNode } from 'react';
import styled, { CSSProperties } from 'styled-components';

// NOTE Used for descendant components
export const StyledContent = styled.div`
  display: flex;
  align-items: center;
  width: 100%;
`;

export const StyledText = styled.span`
  font-size: var(--font-size-md);
  font-weight: 500;
  margin-inline-start: var(--margins-lg);
  margin-inline-end: var(--margins-lg);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
  /* TODO needs RTL support */
  text-align: left;
`;

const StyledRoundedPanelButtonGroup = styled.div`
  overflow: hidden;
  background: var(--right-panel-item-background-color);
  border-radius: 16px;
  padding: var(--margins-lg);
  margin: 0 var(--margins-lg);
  width: -webkit-fill-available;
`;

const PanelButtonContainer = styled.div`
  overflow: auto;
  min-height: 40px;
  max-height: 100%;
`;

type PanelButtonGroupProps = {
  children: ReactNode;
  style?: CSSProperties;
};

export const PanelButtonGroup = (props: PanelButtonGroupProps) => {
  const { children, style } = props;
  return (
    <StyledRoundedPanelButtonGroup style={style}>
      <PanelButtonContainer>{children}</PanelButtonContainer>
    </StyledRoundedPanelButtonGroup>
  );
};

const StyledPanelButton = styled.button<{
  disableBg?: boolean;
}>`
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  flex-grow: 1;
  font-family: var(--font-default);
  padding: 0px var(--margins-sm);
  height: '50px';
  width: 100%;
  transition: var(--default-duration);
  background-color: ${props =>
    !props.disableBg ? 'var(--right-panel-item-background-hover-color) !important' : null};

  :not(:last-child) {
    border-bottom: 1px solid var(--border-color);
  }
`;

export type PanelButtonProps = {
  // https://styled-components.com/docs/basics#styling-any-component
  className?: string;
  disableBg?: boolean;
  children: ReactNode;
  onClick: (...args: any[]) => void;
  dataTestId?: string;
  style?: CSSProperties;
};

export const PanelButton = (props: PanelButtonProps) => {
  const { className, disableBg, children, onClick, dataTestId, style } = props;

  return (
    <StyledPanelButton
      className={className}
      disableBg={disableBg}
      onClick={onClick}
      style={style}
      data-testid={dataTestId}
    >
      {children}
    </StyledPanelButton>
  );
};
