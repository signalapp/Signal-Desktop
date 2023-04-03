import React, { ReactNode } from 'react';
import styled from 'styled-components';

const StyledRoundedPanelButtonGroup = styled.div`
  overflow: hidden;
  background: var(--background-secondary-color);
  border: 1px solid var(--border-color);
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

export const PanelButtonGroup = ({ children }: { children: ReactNode }) => {
  return (
    <StyledRoundedPanelButtonGroup>
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
    !props.disableBg ? 'var(--conversation-tab-background-selected-color) !important' : null};

  :not(:last-child) {
    border-bottom: 1px solid var(--border-color);
  }
`;

export type PanelButtonProps = {
  disableBg?: boolean;
  children: ReactNode;
  onClick: (...args: any[]) => void;
  dataTestId?: string;
};

export const PanelButton = (props: PanelButtonProps) => {
  const { disableBg, children, onClick, dataTestId } = props;

  return (
    <StyledPanelButton
      disableBg={disableBg}
      onClick={onClick}
      style={
        !disableBg
          ? {
              backgroundColor: 'var(--background-primary-color)',
            }
          : {}
      }
      data-testid={dataTestId}
    >
      {children}
    </StyledPanelButton>
  );
};
