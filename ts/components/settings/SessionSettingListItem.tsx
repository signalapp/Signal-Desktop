import React from 'react';
import classNames from 'classnames';
import { SessionButton, SessionButtonColor } from '../basic/SessionButton';
import { SessionToggle } from '../basic/SessionToggle';
import { SessionConfirmDialogProps } from '../dialog/SessionConfirm';

type ButtonSettingsProps = {
  title?: string;
  description?: string;
  buttonColor: SessionButtonColor;
  buttonText: string;
  dataTestId?: string;
  onClick: () => void;
};

const SettingsTitleAndDescription = (props: { title?: string; description?: string }) => {
  return (
    <div className="session-settings-item__info">
      <div className="session-settings-item__title">{props.title}</div>

      {props.description && (
        <div className="session-settings-item__description">{props.description}</div>
      )}
    </div>
  );
};

const SessionSettingsContent = (props: { children: React.ReactNode }) => {
  return <div className="session-settings-item__content">{props.children}</div>;
};

export const SessionSettingsItemWrapper = (props: {
  inline: boolean;
  title?: string;
  description?: string;
  children: React.ReactNode;
}) => {
  return (
    <div className={classNames('session-settings-item', props.inline && 'inline')}>
      <SettingsTitleAndDescription title={props.title} description={props.description} />
      <SessionSettingsContent>{props.children}</SessionSettingsContent>
    </div>
  );
};

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
