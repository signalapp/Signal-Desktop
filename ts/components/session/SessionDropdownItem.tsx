import React from 'react';
import classNames from 'classnames';

import { SessionIcon, SessionIconSize, SessionIconType } from './icon/';

export enum SessionDropDownItemType {
  Default = 'default',
  Danger = 'danger',
}

interface Props {
  content: string;
  type: SessionDropDownItemType;
  icon: SessionIconType | null;
  active: boolean;
  onClick: any;
}

export class SessionDropdownItem extends React.PureComponent<Props> {
  public static defaultProps = {
    type: SessionDropDownItemType.Default,
    icon: null,
    active: false,
    onClick: () => null,
  };

  constructor(props: any) {
    super(props);
    this.clickHandler = this.clickHandler.bind(this);
  }

  public render() {
    const { content, type, icon, active } = this.props;

    return (
      <div
        className={classNames(
          'session-dropdown__item',
          active ? 'active' : '',
          type || ''
        )}
        role="button"
        onClick={this.clickHandler}
      >
        {icon ? (
          <SessionIcon iconType={icon} iconSize={SessionIconSize.Small} />
        ) : (
          ''
        )}
        <div className="item-content">{content}</div>
      </div>
    );
  }

  private clickHandler(e: any) {
    if (this.props.onClick) {
      e.stopPropagation();
      this.props.onClick();
    }
  }
}
