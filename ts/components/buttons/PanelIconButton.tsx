import React from 'react';
import styled from 'styled-components';
import { SessionIcon, SessionIconType } from '../icon';
import { PanelButton, PanelButtonProps, PanelButtonText, StyledContent } from './PanelButton';

interface PanelIconButton extends Omit<PanelButtonProps, 'children'> {
  iconType: SessionIconType;
  text: string;
  subtitle?: string;
  color?: string;
}

const IconContainer = styled.div`
  flex-shrink: 0;
  width: var(--toggle-width);
`;

export const PanelIconButton = (props: PanelIconButton) => {
  const { iconType, text, subtitle, color, disabled = false, onClick, dataTestId } = props;

  return (
    <PanelButton disabled={disabled} onClick={onClick} dataTestId={dataTestId}>
      <StyledContent disabled={disabled}>
        <IconContainer>
          <SessionIcon iconType={iconType} iconColor={color} iconSize="medium" />
        </IconContainer>
        <PanelButtonText text={text} subtitle={subtitle} color={color} />
      </StyledContent>
    </PanelButton>
  );
};
