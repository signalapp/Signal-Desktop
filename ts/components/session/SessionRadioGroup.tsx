import React, { useEffect, useState } from 'react';

import { SessionRadio } from './SessionRadio';

interface Props {
  // tslint:disable: react-unused-props-and-state
  initialItem: string;
  items: Array<any>;
  group: string;
  onClick: (selectedValue: string) => any;
}

export const SessionRadioGroup = (props: Props) => {
  const [activeItem, setActiveItem] = useState('');
  const { items, group, initialItem } = props;

  useEffect(() => {
    console.warn('unMNount:', initialItem);
    setActiveItem(initialItem);
  }, []);

  return (
    <div className="session-radio-group">
      <fieldset id={group}>
        {items.map(item => {
          const itemIsActive = item.value === activeItem;

          return (
            <SessionRadio
              key={item.value}
              label={item.label}
              active={itemIsActive}
              value={item.value}
              group={group}
              onClick={(value: string) => {
                setActiveItem(value);
                props.onClick(value);
              }}
            />
          );
        })}
      </fieldset>
    </div>
  );
};
