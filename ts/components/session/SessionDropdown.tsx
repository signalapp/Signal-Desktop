import React from 'react';
import classNames from 'classnames';

import { SessionIconType } from './icon/';
import { SessionDropdownItem, SessionDropDownItemType } from './SessionDropdownItem';

// THIS IS A FUTURE-PROOFING ELEMENT TO REPLACE ELECTRON CONTEXTMENUS IN PRELOAD.JS

interface Props {
    id?: string,
    items: Array<{
        content: string,
        id?: string,
        icon?: SessionIconType | null,
        type?: SessionDropDownItemType,
        active?: boolean,
        onClick?: any,
        display?: boolean,
      }>,
  }

export class SessionDropdown extends React.PureComponent<Props> {
  
  constructor(props: any) {
    super(props);
  }
  
  public render() {
    const { items } = this.props;

    return (
      <div className={classNames('session-dropdown')}>
        <ul>
            {items.map((item: any) => {
                return item.display ? (
                    <SessionDropdownItem
                        id={item.id}
                        content={item.content}
                        icon={item.icon}
                        type={item.type}
                        active={item.active}
                        onClick={item.onClick}
                    />
                ) : null
              }
            )}
        </ul>
      </div>
    );
  }

}

