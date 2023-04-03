import React from 'react';
import styled from 'styled-components';
import { Flex } from '../basic/Flex';
import { SessionRadio } from '../basic/SessionRadio';
import { PanelButton, PanelButtonProps, StyledContent, StyledText } from './PanelButton';

const StyledPanelButton = styled(PanelButton)`
  padding-top: var(--margins-lg);
  padding-bottom: var(--margins-lg);

  div {
    span {
      margin-inline-start: 0;
      margin-inline-end: 0;
    }
  }

  :first-child {
    padding-top: 0;
  }

  :last-child {
    padding-bottom: 0;
  }
`;

const StyledSubtitle = styled.p`
  font-size: var(--font-size-xs);
  margin: 0;
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
  const { value, text, subtitle, isSelected, onSelect, onUnselect, disableBg, dataTestId } = props;

  return (
    <StyledPanelButton
      disableBg={disableBg}
      onClick={() => {
        isSelected ? onUnselect?.('bye') : onSelect?.('hi');
      }}
      dataTestId={dataTestId}
    >
      <StyledContent>
        <Flex container={true} width={'100%'} flexDirection={'column'} alignItems={'flex-start'}>
          <StyledText>{text}</StyledText>
          {subtitle && <StyledSubtitle>{subtitle}</StyledSubtitle>}
        </Flex>
        <StyledCheckContainer>
          <SessionRadio active={isSelected} value={value} inputName={value} label="" />
        </StyledCheckContainer>
      </StyledContent>
    </StyledPanelButton>
  );
};
