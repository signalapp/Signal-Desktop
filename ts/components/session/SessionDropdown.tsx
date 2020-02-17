import React from 'react';

import { SessionIcon, SessionIconSize, SessionIconType } from './icon/';
import {
  SessionDropdownItem,
  SessionDropDownItemType,
} from './SessionDropdownItem';

// THIS IS DROPDOWN ACCORDIAN STYLE OPTIONS SELECTOR ELEMENT, NOT A CONTEXTMENU

interface State {
  expanded: boolean;
}

interface Props {
  label: string;
  onClick?: any;
  expanded?: boolean;
  options: Array<{
    content: string;
    id?: string;
    icon?: SessionIconType | null;
    type?: SessionDropDownItemType;
    active?: boolean;
    onClick?: any;
  }>;
}

export class SessionDropdown extends React.Component<Props, State> {
  public static defaultProps = {
    expanded: false,
  };

  constructor(props: any) {
    super(props);

    this.state = {
      expanded: !!this.props.expanded,
    };

    this.toggleDropdown = this.toggleDropdown.bind(this);
  }

  public render() {
    const { label, options } = this.props;
    const { expanded } = this.state;
    const chevronOrientation = expanded ? 180 : 0;

    return (
      <div className="session-dropdown">
        <div
          className="session-dropdown__label"
          onClick={this.toggleDropdown}
          role="button"
        >
          {label}
          <SessionIcon
            iconType={SessionIconType.Chevron}
            iconSize={SessionIconSize.Small}
            iconRotation={chevronOrientation}
          />
        </div>

        {expanded && (
          <div className="session-dropdown__list-container">
            {options.map((item: any) => {
              return (
                <SessionDropdownItem
                  key={item.content}
                  content={item.content}
                  icon={item.icon}
                  type={item.type}
                  active={item.active}
                  onClick={() => {
                    this.handleItemClick(item.onClick);
                  }}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  }

  public toggleDropdown() {
    this.setState({
      expanded: !this.state.expanded,
    });
  }

  public handleItemClick(itemOnClickFn: any) {
    this.setState({ expanded: false }, itemOnClickFn());
  }
}
