import React, { useContext, useState } from 'react';
import { ThemeContext } from 'styled-components';

import { SessionIcon, SessionIconSize, SessionIconType } from './icon/';
import { SessionDropdownItem, SessionDropDownItemType } from './SessionDropdownItem';

// THIS IS DROPDOWN ACCORDIAN STYLE OPTIONS SELECTOR ELEMENT, NOT A CONTEXTMENU

type Props = {
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
};

export const SessionDropdown = (props: Props) => {
  const { label, options } = props;
  const [expanded, setExpanded] = useState(!!props.expanded);
  const theme = useContext(ThemeContext);
  const chevronOrientation = expanded ? 180 : 0;

  return (
    <div className="session-dropdown">
      <div
        className="session-dropdown__label"
        onClick={() => {
          setExpanded(!expanded);
        }}
        role="button"
      >
        {label}
        <SessionIcon
          iconType={SessionIconType.Chevron}
          iconSize={SessionIconSize.Small}
          iconRotation={chevronOrientation}
          theme={theme}
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
                  setExpanded(false);
                  item.onClick();
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
