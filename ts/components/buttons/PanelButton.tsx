import { ReactNode } from 'react';
import styled, { CSSProperties } from 'styled-components';
import { Flex } from '../basic/Flex';

// NOTE Used for descendant components
export const StyledContent = styled.div<{ disabled: boolean }>`
  display: flex;
  align-items: center;
  width: 100%;
  color: ${props => (props.disabled ? 'var(--disabled-color)' : 'inherit')};
`;

export const StyledText = styled.span<{ color?: string }>`
  font-size: var(--font-size-md);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
  text-align: start;
  ${props => props.color && `color: ${props.color};`}
`;

export const PanelLabel = styled.p`
  color: var(--text-secondary-color);
  width: 100%;
  margin: 0;
  padding-left: calc(var(--margins-lg) * 2 + var(--margins-sm));
  padding-bottom: var(--margins-sm);
`;

const StyledRoundedPanelButtonGroup = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  overflow: hidden;
  background: var(--right-panel-item-background-color);
  border-radius: 16px;
  padding: 0 var(--margins-lg) var(--margins-xs);
  margin: 0 var(--margins-lg);
  width: -webkit-fill-available;
`;

const PanelButtonContainer = styled.div`
  overflow: auto;
  min-height: 65px;
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
  disabled: boolean;
}>`
  cursor: ${props => (props.disabled ? 'not-allowed' : 'pointer')};
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  flex-grow: 1;
  font-family: var(--font-default);
  height: 65px;
  width: 100%;
  transition: var(--default-duration);
  color: ${props => (props.disabled ? 'var(--disabled-color)' : 'inherit')};

  &:not(:last-child) {
    border-bottom: 1px solid var(--border-color);
  }
`;

export type PanelButtonProps = {
  // https://styled-components.com/docs/basics#styling-any-component
  className?: string;
  disabled?: boolean;
  children: ReactNode;
  onClick: (...args: Array<any>) => void;
  dataTestId: string;
  style?: CSSProperties;
};

export const PanelButton = (props: PanelButtonProps) => {
  const { className, disabled = false, children, onClick, dataTestId, style } = props;

  return (
    <StyledPanelButton
      className={className}
      disabled={disabled}
      onClick={onClick}
      style={style}
      data-testid={dataTestId}
    >
      {children}
    </StyledPanelButton>
  );
};

const StyledSubtitle = styled.p<{ color?: string }>`
  font-size: var(--font-size-xs);
  line-height: 1.1;
  margin-top: 0;
  margin-bottom: 0;
  text-align: start;
  ${props => props.color && `color: ${props.color};`}
`;

export const PanelButtonText = (props: { text: string; subtitle?: string; color?: string }) => {
  return (
    <Flex
      container={true}
      width={'100%'}
      flexDirection={'column'}
      alignItems={'flex-start'}
      margin="0 var(--margins-lg) 0 0"
      minWidth="0"
    >
      <StyledText color={props.color}>{props.text}</StyledText>
      {!!props.subtitle && <StyledSubtitle color={props.color}>{props.subtitle}</StyledSubtitle>}
    </Flex>
  );
};
