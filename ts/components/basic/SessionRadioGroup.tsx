import React, { useEffect, useState } from 'react';
import styled from 'styled-components';

import { SessionRadio } from './SessionRadio';

interface Props {
  // tslint:disable: react-unused-props-and-state
  initialItem: string;
  items: Array<any>;
  group: string;
  onClick: (selectedValue: string) => any;
}

const StyledFieldSet = styled.fieldset`
  border: none;
  margin-inline-start: var(--margins-sm);
  margin-top: var(--margins-sm);
`;

export const SessionRadioGroup = (props: Props) => {
  const [activeItem, setActiveItem] = useState('');
  const { items, group, initialItem } = props;

  useEffect(() => {
    setActiveItem(initialItem);
  }, []);

  return (
    <StyledFieldSet id={group}>
      {items.map(item => {
        const itemIsActive = item.value === activeItem;

        return (
          <SessionRadio
            key={item.value}
            label={item.label}
            active={itemIsActive}
            value={item.value}
            inputName={group}
            onClick={(value: string) => {
              setActiveItem(value);
              props.onClick(value);
            }}
          />
        );
      })}
    </StyledFieldSet>
  );
};
