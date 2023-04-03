import React from 'react';
import { SessionIcon, SessionIconType } from '../icon';
import { PanelButton, PanelButtonProps, StyledContent, StyledText } from './PanelButton';

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
