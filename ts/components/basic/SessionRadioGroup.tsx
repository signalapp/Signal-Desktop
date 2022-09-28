import React, { useEffect, useState } from 'react';
import styled, { CSSProperties } from 'styled-components';

import { SessionRadio } from './SessionRadio';

interface Props {
  // tslint:disable: react-unused-props-and-state
  initialItem: string;
  items: Array<{ value: string; label: string }>;
  group: string;
  onClick: (selectedValue: string) => any;
  style?: CSSProperties;
}

const StyledFieldSet = styled.fieldset`
  display: flex;
  flex-direction: column;

  border: none;
  margin-inline-start: var(--margins-sm);
  margin-top: var(--margins-sm);

  & > div {
    padding-block: 7px;
  }
  & > div + div {
    border-top: 1px solid var(--color-session-border);
  }
`;

export const SessionRadioGroup = (props: Props) => {
  const { items, group, initialItem, style } = props;
  const [activeItem, setActiveItem] = useState('');

  useEffect(() => {
    setActiveItem(initialItem);
  }, []);

  return (
    <StyledFieldSet id={group} style={style}>
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
            beforeMargins={'0 var(--margins-sm) 0 0 '}
          />
        );
      })}
    </StyledFieldSet>
  );
};
