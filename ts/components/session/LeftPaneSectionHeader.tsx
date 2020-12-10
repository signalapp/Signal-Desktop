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
  onTabSelected: any;
  selectedTab: number;
  labels: Array<string>;
  buttonLabel?: string;
  buttonIcon?: SessionIconType;
  buttonClicked?: any;
  theme: DefaultTheme;
}

interface State {
  selectedTab: number;
}

export class LeftPaneSectionHeader extends React.Component<Props, State> {
  constructor(props: any) {
    super(props);
    this.state = { selectedTab: 0 };
  }

  public render() {
    const { selectedTab } = this.state;
    const { labels, buttonLabel, buttonIcon, buttonClicked } = this.props;

    const hasButton = buttonLabel || buttonIcon;

    const children = [];
    //loop to create children
    for (let i = 0; i < labels.length; i++) {
      children.push(
        <Tab
          label={labels[i]}
          type={i}
          isSelected={selectedTab === i}
          onSelect={this.handleTabSelect}
          key={i}
        />
      );
    }

    if (hasButton) {
      const buttonContent = buttonIcon ? (
        <SessionIcon
          iconType={buttonIcon}
          iconSize={SessionIconSize.Small}
          theme={inversedTheme(this.props.theme)}
        />
      ) : (
        buttonLabel
      );
      const button = (
        <SessionButton
          onClick={buttonClicked}
          key="compose"
          theme={inversedTheme(this.props.theme)}
        >
          {buttonContent}
        </SessionButton>
      );

      children.push(button);
    }
    // Create the parent and add the children
    return <div className="module-left-pane__header">{children}</div>;
  }

  private readonly handleTabSelect = (tabType: number): void => {
    this.setState({
      selectedTab: tabType,
    });
    if (this.props.onTabSelected) {
      this.props.onTabSelected(tabType);
    }
  };
}
