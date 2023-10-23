import React from 'react';
import { SpacerLG } from '../basic/Text';
import { SessionIcon, SessionIconType } from '../icon';
import { PanelButton, PanelButtonProps, StyledContent, StyledText } from './PanelButton';

interface PanelIconButton extends Omit<PanelButtonProps, 'children'> {
  iconType: SessionIconType | null;
  text: string;
}

export const PanelIconButton = (props: PanelIconButton) => {
  const { iconType, text, disabled = false, onClick, dataTestId } = props;

  return (
    <PanelButton disabled={disabled} onClick={onClick} dataTestId={dataTestId}>
      <StyledContent disabled={disabled}>
        {iconType ? <SessionIcon iconType={iconType} iconSize="medium" /> : <SpacerLG />}
        <StyledText>{text}</StyledText>
      </StyledContent>
    </PanelButton>
  );
};
