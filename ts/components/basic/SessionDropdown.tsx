import { useState } from 'react';
import { SessionIcon, SessionIconType } from '../icon';

import { SessionDropdownItem, SessionDropDownItemType } from './SessionDropdownItem';

// THIS IS DROPDOWN ACCORDION STYLE OPTIONS SELECTOR ELEMENT, NOT A CONTEXTMENU

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
  dataTestId?: string;
};

export const SessionDropdown = (props: Props) => {
  const { label, options, dataTestId } = props;
  const [expanded, setExpanded] = useState(!!props.expanded);
  const chevronOrientation = expanded ? 180 : 0;

  return (
    <div className="session-dropdown" data-testid={dataTestId}>
      <div
        className="session-dropdown__label"
        onClick={() => {
          setExpanded(!expanded);
        }}
        role="button"
      >
        {label}
        <SessionIcon iconType="chevron" iconSize="small" iconRotation={chevronOrientation} />
      </div>

      {expanded && (
        <div className="session-dropdown__list-container">
          {options.map((item: any) => {
            return (
              <SessionDropdownItem
                key={item.content}
                dataTestId={`dropdownitem-${item.content.replace(' ', '-')}`}
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
