import React from 'react';
import classNames from 'classnames';
import { SessionIcon, SessionIconType } from '../icon';

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
  dataTestId?: string;
};

export const SessionDropdownItem = (props: Props) => {
  const clickHandler = (e: any) => {
    if (props.onClick) {
      e.stopPropagation();
      props.onClick();
    }
  };

  const { content, type, icon, active, dataTestId } = props;

  return (
    <div
      className={classNames(
        'session-dropdown__item',
        active ? 'active' : '',
        type || SessionDropDownItemType.Default
      )}
      role="button"
      onClick={clickHandler}
      data-testid={dataTestId}
    >
      {icon ? <SessionIcon iconType={icon} iconSize="small" /> : ''}
      <div className="item-content">{content}</div>
    </div>
  );
};
