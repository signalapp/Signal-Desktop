import React from 'react';
import { Flex } from '../basic/Flex';
// tslint:disable: react-unused-props-and-state

interface Props {
  label: string;
  value: string;
  active: boolean;
  group?: string;
  onClick: (value: string) => any;
}

export const SessionRadio = (props: Props) => {
  const { label, group, value, active, onClick } = props;

  function clickHandler(e: any) {
    e.stopPropagation();
    onClick(value);
  }

  return (
    <Flex>
      <input
        type="radio"
        name={group || ''}
        value={value}
        aria-checked={active}
        checked={active}
        onClick={clickHandler}
      />
      <label role="button" onClick={clickHandler}>
        {label}
      </label>
    </Flex>
  );
};
