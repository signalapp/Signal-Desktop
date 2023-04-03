import React from 'react';
import styled from 'styled-components';
import { SessionIcon, SessionIconType } from '../icon';
import { PanelButton, PanelButtonProps } from './PanelButton';

const StyledContent = styled.div`
  display: flex;
  align-items: center;
  width: 100%;
`;

const StyledText = styled.span`
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

interface PanelIconButton extends Omit<PanelButtonProps, 'children'> {
  iconType: SessionIconType;
  text: string;
}

export const PanelIconButton = (props: PanelIconButton) => {
  const { iconType, text, disableBg, onClick, dataTestId } = props;

  return (
    <PanelButton disableBg={disableBg} onClick={onClick} dataTestId={dataTestId}>
      <StyledContent>
        <SessionIcon iconType={iconType} iconSize="medium" />
        <StyledText>{text}</StyledText>
      </StyledContent>
    </PanelButton>
  );
};
