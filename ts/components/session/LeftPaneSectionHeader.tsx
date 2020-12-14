import React from 'react';
import classNames from 'classnames';
import { SessionButton } from './SessionButton';
import { SessionIcon, SessionIconSize, SessionIconType } from './icon';
import { inversedTheme } from '../../state/ducks/SessionTheme';
import { DefaultTheme } from 'styled-components';

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
      className={classNames(
        'module-left-pane__title',
        isSelected ? 'active' : null
      )}
      onClick={handleClick}
      role="button"
    >
      {label}
    </h1>
  );
};

interface Props {
  label?: string;
  buttonIcon?: SessionIconType;
  buttonClicked?: any;
  theme: DefaultTheme;
}

export const LeftPaneSectionHeader = (props: Props) => {
  const { label, buttonIcon, buttonClicked } = props;

  const children = [];
  if (label) {
    children.push(<Tab label={label} type={0} isSelected={true} key={label} />);
  }

  if (buttonIcon) {
    const button = (
      <SessionButton
        onClick={buttonClicked}
        key="compose"
        theme={inversedTheme(props.theme)}
      >
        <SessionIcon
          iconType={buttonIcon}
          iconSize={SessionIconSize.Small}
          theme={props.theme}
        />
      </SessionButton>
    );

    children.push(button);
  }
  // Create the parent and add the children
  return <div className="module-left-pane__header">{children}</div>;
};
