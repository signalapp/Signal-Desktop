import React from 'react';
import classNames from 'classnames';

import { SessionIconType } from './icon/';
import {
  SessionDropdownItem,
  SessionDropDownItemType,
} from './SessionDropdownItem';

// THIS IS A FUTURE-PROOFING ELEMENT TO REPLACE ELECTRON CONTEXTMENUS IN PRELOAD.JS

interface State {
  x: number;
  y: number;
  isVisible: boolean;
}

interface Props {
  id?: string;
  onClick?: any;
  relativeTo: string | Array<number>;
  items: Array<{
    content: string;
    id?: string;
    icon?: SessionIconType | null;
    type?: SessionDropDownItemType;
    active?: boolean;
    onClick?: any;
    display?: boolean;
  }>;
}

export class SessionDropdown extends React.Component<Props, State> {
  constructor(props: any) {
    super(props);

    this.state = {
      x: 0,
      y: 0,
      isVisible: false,
    };
  }

  public show() {
    this.setState({
      isVisible: true,
    });
  }

  public hide() {
    this.setState({
      isVisible: false,
    });
  }

  public render() {
    const { items } = this.props;
    const { isVisible } = this.state;

    return (
      <div className={classNames('session-dropdown')}>
        <ul>
          {isVisible
            ? items.map((item: any) => {
                return item.display ? (
                  <SessionDropdownItem
                    id={item.id}
                    content={item.content}
                    icon={item.icon}
                    type={item.type}
                    active={item.active}
                    onClick={item.onClick}
                  />
                ) : null;
              })
            : null}
        </ul>
      </div>
    );
  }
}
