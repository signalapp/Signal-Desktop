import React from 'react';
import classNames from 'classnames';
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
  notificationCount?: number;
  buttonLabel?: string;
  buttonClicked?: any;
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
    return this.renderTabs();
  }

  private renderTabs() {
    const { selectedTab } = this.state;
    const {
      labels,
      buttonLabel,
      buttonClicked,
      notificationCount,
    } = this.props;

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

    if (buttonLabel && !notificationCount) {
      children.push(
        <SessionButton
          text={buttonLabel}
          onClick={buttonClicked}
          key="compose"
          disabled={false}
        />
      );
    } else if (buttonLabel && notificationCount && notificationCount > 0) {
      const shortenedNotificationCount =
        notificationCount > 9 ? 9 : notificationCount;
      children.push(
        <div className="contact-notification-section">
          <SessionButton
            text={buttonLabel}
            onClick={buttonClicked}
            key="compose"
            disabled={false}
          />
          <div
            className="contact-notification-count-bubble"
            onClick={this.props.buttonClicked}
            role="button"
          >
            {shortenedNotificationCount}
          </div>
        </div>
      );
    } else if (notificationCount && notificationCount > 0) {
      const shortenedNotificationCount =
        notificationCount > 9 ? 9 : notificationCount;
      children.push(
        <div
          className="contact-notification-count-bubble"
          onClick={this.props.buttonClicked}
          role="button"
        >
          {shortenedNotificationCount}
        </div>
      );
    }

    //Create the parent and add the children
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
