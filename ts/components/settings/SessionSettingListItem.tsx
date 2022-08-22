import React from 'react';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { SessionToggle } from '../basic/SessionToggle';
import { SessionConfirmDialogProps } from '../dialog/SessionConfirm';
import styled from 'styled-components';

type ButtonSettingsProps = {
  title?: string;
  description?: string;
  buttonColor: SessionButtonColor;
  buttonType: SessionButtonType;
  buttonText: string;
  dataTestId?: string;
  onClick: () => void;
};

const StyledDescription = styled.div`
  font-family: var(--font-default);
  font-size: var(--font-size-sm);
  font-weight: 400;
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

const StyledDescriptionContainer = styled(StyledDescription)`
  display: flex;
  align-items: center;
`;

const SettingsTitleAndDescription = (props: {
  title?: string;
  description?: string;
  childrenDescription?: React.ReactNode;
}) => {
  const { description, childrenDescription, title } = props;
  return (
    <StyledInfo>
      <StyledTitle>{title}</StyledTitle>
      <StyledDescriptionContainer>
        {description && <StyledDescription>{description}</StyledDescription>}
        <>{childrenDescription}</>
      </StyledDescriptionContainer>
    </StyledInfo>
  );
};

export const SessionSettingsItemWrapper = (props: {
  inline: boolean;
  title?: string;
  description?: string;
  isTypingMessageItem?: boolean;
  children?: React.ReactNode;
  childrenDescription?: React.ReactNode;
}) => {
  const { inline, children, description, title, childrenDescription } = props;
  const ComponentToRender = inline ? StyledSettingItemInline : StyledSettingItem;
  return (
    <ComponentToRender>
      <SettingsTitleAndDescription
        title={title}
        description={description}
        childrenDescription={childrenDescription}
      />
      <div>{children}</div>
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
  childrenDescription?: React.ReactNode; // if set, those elements will be appended next to description field (only used for typing message settings as of now)
}) => {
  const {
    title,
    description,
    active,
    onClickToggle,
    confirmationDialogParams,
    childrenDescription,
  } = props;

  return (
    <SessionSettingsItemWrapper
      title={title}
      description={description}
      inline={true}
      childrenDescription={childrenDescription}
    >
      <SessionToggle
        active={active}
        onClick={onClickToggle}
        confirmationDialogParams={confirmationDialogParams}
      />
    </SessionSettingsItemWrapper>
  );
};

export const SessionSettingButtonItem = (props: ButtonSettingsProps) => {
  const { title, description, buttonColor, buttonType, buttonText, dataTestId, onClick } = props;

  return (
    <SessionSettingsItemWrapper title={title} description={description} inline={true}>
      <SessionButton
        dataTestId={dataTestId}
        text={buttonText}
        buttonColor={buttonColor}
        onClick={onClick}
        buttonType={buttonType}
      />
    </SessionSettingsItemWrapper>
  );
};
