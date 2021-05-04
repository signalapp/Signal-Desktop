import React from 'react';
import classNames from 'classnames';
import { SessionIcon, SessionIconSize, SessionIconType } from './icon';
import { DefaultTheme } from 'styled-components';
import { SessionButton } from './SessionButton';

const Tab = ({
  isSelected,
  label,
  onSelect,
  type,
}: {
  isSelected: boolean;
  label: string;
  onSelect?: (event: number) => void;
  type: number;
}) => {
  const handleClick = onSelect
    ? () => {
        onSelect(type);
      }
    : undefined;

  return (
    <h1
      className={classNames('module-left-pane__title', isSelected ? 'active' : null)}
      onClick={handleClick}
      role="button"
    >
      {label}
    </h1>
  );
};

type Props = {
  label?: string;
  buttonIcon?: SessionIconType;
  buttonClicked?: any;
  theme: DefaultTheme;
};

export const LeftPaneSectionHeader = (props: Props) => {
  const { label, buttonIcon, buttonClicked } = props;

  return (
    <div className="module-left-pane__header">
      {label && <Tab label={label} type={0} isSelected={true} key={label} />}
      {buttonIcon && (
        <SessionButton onClick={buttonClicked} key="compose" theme={props.theme}>
          <SessionIcon
            iconType={buttonIcon}
            iconSize={SessionIconSize.Small}
            iconColor="white"
            theme={props.theme}
          />
        </SessionButton>
      )}
    </div>
  );
};
