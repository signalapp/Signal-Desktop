import React from 'react';
import { SessionIcon, SessionIconType } from '../icon';
import { PanelButton, PanelButtonProps, StyledContent, StyledText } from './PanelButton';

interface PanelIconButton extends Omit<PanelButtonProps, 'children'> {
  iconType: SessionIconType;
  text: string;
}

export const PanelIconButton = (props: PanelIconButton) => {
  const { iconType, text, disabled = false, onClick, dataTestId } = props;

  return (
    <PanelButton disabled={disabled} onClick={onClick} dataTestId={dataTestId}>
      <StyledContent disabled={disabled}>
        <SessionIcon iconType={iconType} iconSize="medium" />
        <StyledText>{text}</StyledText>
      </StyledContent>
    </PanelButton>
  );
};
