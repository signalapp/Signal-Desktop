import styled from 'styled-components';
import { SessionIcon, SessionIconSize, SessionIconType } from '../icon';
import { PanelButton, PanelButtonProps, PanelButtonText, StyledContent } from './PanelButton';

interface PanelIconButton extends Omit<PanelButtonProps, 'children'> {
  text: string;
  iconType: SessionIconType;
  iconSize?: SessionIconSize;
  subtitle?: string;
  color?: string;
}

const IconContainer = styled.div`
  flex-shrink: 0;
  margin: 0 var(--margins-lg) 0 var(--margins-sm);
  padding: 0;
`;

export const PanelIconButton = (props: PanelIconButton) => {
  const {
    text,
    subtitle,
    iconType,
    iconSize,
    color,
    disabled = false,
    onClick,
    dataTestId,
  } = props;

  return (
    <PanelButton disabled={disabled} onClick={onClick} dataTestId={dataTestId}>
      <StyledContent disabled={disabled}>
        <IconContainer>
          <SessionIcon iconType={iconType} iconColor={color} iconSize={iconSize || 'large'} />
        </IconContainer>
        <PanelButtonText text={text} subtitle={subtitle} color={color} />
      </StyledContent>
    </PanelButton>
  );
};
