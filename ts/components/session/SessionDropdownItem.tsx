import React, { useContext } from 'react';
import classNames from 'classnames';

import { SessionIcon, SessionIconSize, SessionIconType } from './icon/';
import { ThemeContext } from 'styled-components';

export enum SessionDropDownItemType {
  Default = 'default',
  Danger = 'danger',
}

type Props = {
  content: string;
  type: SessionDropDownItemType;
  icon: SessionIconType | null;
  active: boolean;
  onClick: any;
};

export const SessionDropdownItem = (props: Props) => {
  const clickHandler = (e: any) => {
    if (props.onClick) {
      e.stopPropagation();
      props.onClick();
    }
  };

  const { content, type, icon, active } = props;
  const theme = useContext(ThemeContext);

  return (
    <div
      className={classNames(
        'session-dropdown__item',
        active ? 'active' : '',
        type || SessionDropDownItemType.Default
      )}
      role="button"
      onClick={clickHandler}
    >
      {icon ? <SessionIcon iconType={icon} iconSize={SessionIconSize.Small} theme={theme} /> : ''}
      <div className="item-content">{content}</div>
    </div>
  );
};
