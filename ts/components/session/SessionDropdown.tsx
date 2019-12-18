import React from 'react';
import classNames from 'classnames';

import { SessionDropdownItem, SessionDropDownItemType } from './SessionDropdownItem';
import { SessionIconType } from './icon/';


interface Props {
    items: Array<{
        id: string,
        content: string,
        icon: SessionIconType | null,
        type: SessionDropDownItemType,
        active: boolean,
      }>,
  }

export class SessionDropdown extends React.PureComponent<Props> {
  public static readonly defaultProps = SessionDropdownItem.defaultProps;
      
  constructor(props: any) {
    super(props);
  }
  
  public render() {
    const { items } = this.props;

    return (
      <div className={classNames('session-dropdown')}>
        <ul>
            {items.map((item: any) => <SessionDropdownItem
                    id={item.id}
                    content={item.content}
                    icon={item.icon}
                    type={item.type}
                    active={item.active}
                />
            )}
        </ul>
      </div>
    );
  }

}

