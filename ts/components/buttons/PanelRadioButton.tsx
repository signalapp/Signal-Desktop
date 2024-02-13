import styled from 'styled-components';
import { SessionRadio } from '../basic/SessionRadio';
import { PanelButton, PanelButtonProps, PanelButtonText, StyledContent } from './PanelButton';

const StyledPanelButton = styled(PanelButton)`
  padding-top: var(--margins-lg);
  padding-bottom: var(--margins-lg);
  text-align: start;
`;

const StyledCheckContainer = styled.div`
  display: flex;
  align-items: center;
`;

interface PanelRadioButtonProps extends Omit<PanelButtonProps, 'children' | 'onClick'> {
  value: any;
  text: string;
  subtitle?: string;
  isSelected: boolean;
  onSelect?: (...args: Array<any>) => void;
  onUnselect?: (...args: Array<any>) => void;
}

export const PanelRadioButton = (props: PanelRadioButtonProps) => {
  const {
    value,
    text,
    subtitle,
    isSelected,
    onSelect,
    onUnselect,
    disabled = false,
    dataTestId,
  } = props;

  return (
    <StyledPanelButton
      disabled={disabled}
      onClick={() => {
        return isSelected ? onUnselect?.('bye') : onSelect?.('hi');
      }}
      dataTestId={dataTestId}
    >
      <StyledContent disabled={disabled}>
        <PanelButtonText text={text} subtitle={subtitle} />
        <StyledCheckContainer>
          <SessionRadio
            active={isSelected}
            value={value}
            inputName={value}
            label=""
            disabled={disabled}
          />
        </StyledCheckContainer>
      </StyledContent>
    </StyledPanelButton>
  );
};
