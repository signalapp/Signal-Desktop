import React from 'react';
import { SessionButton, SessionButtonColor } from '../basic/SessionButton';
import { SessionToggle } from '../basic/SessionToggle';
import { SessionConfirmDialogProps } from '../dialog/SessionConfirm';
import styled from 'styled-components';

type ButtonSettingsProps = {
  title?: string;
  description?: string;
  buttonColor: SessionButtonColor;
  buttonText: string;
  dataTestId?: string;
  onClick: () => void;
};

const StyledDescription = styled.div`
  font-family: var(--font-default);
  font-size: var(--font-size-sm);
  font-weight: 100;
  max-width: 700px;
  color: var(--color-text-subtle);
`;

const StyledTitle = styled.div`
  line-height: 1.7;
  font-size: var(--font-size-lg);
  font-weight: bold;
`;

const StyledInfo = styled.div`
  padding-inline-end: var(--margins-lg);
`;

const SettingsTitleAndDescription = (props: { title?: string; description?: string }) => {
  return (
    <StyledInfo>
      <StyledTitle>{props.title}</StyledTitle>

      {props.description && <StyledDescription>{props.description}</StyledDescription>}
    </StyledInfo>
  );
};

export const SessionSettingsItemWrapper = (props: {
  inline: boolean;
  title?: string;
  description?: string;
  children?: React.ReactNode;
}) => {
  const ComponentToRender = props.inline ? StyledSettingItemInline : StyledSettingItem;
  return (
    <ComponentToRender>
      <SettingsTitleAndDescription title={props.title} description={props.description} />
      <div>{props.children}</div>
    </ComponentToRender>
  );
};

const StyledSettingItem = styled.div`
  font-size: var(--font-size-md);
  padding: var(--margins-lg);
  margin-bottom: 20px;

  background: var(--color-cell-background);
  color: var(--color-text);
  border-bottom: var(--border-session);
`;

const StyledSettingItemInline = styled(StyledSettingItem)`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

export const SessionToggleWithDescription = (props: {
  title?: string;
  description?: string;
  active: boolean;
  onClickToggle: () => void;
  confirmationDialogParams?: SessionConfirmDialogProps;
}) => {
  const { title, description, active, onClickToggle, confirmationDialogParams } = props;

  return (
    <SessionSettingsItemWrapper title={title} description={description} inline={true}>
      <SessionToggle
        active={active}
        onClick={onClickToggle}
        confirmationDialogParams={confirmationDialogParams}
      />
    </SessionSettingsItemWrapper>
  );
};

export const SessionSettingButtonItem = (props: ButtonSettingsProps) => {
  const { title, description, buttonColor, buttonText, dataTestId, onClick } = props;

  return (
    <SessionSettingsItemWrapper title={title} description={description} inline={true}>
      <SessionButton
        dataTestId={dataTestId}
        text={buttonText}
        buttonColor={buttonColor}
        onClick={onClick}
      />
    </SessionSettingsItemWrapper>
  );
};
