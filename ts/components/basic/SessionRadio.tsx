import React, { ChangeEvent } from 'react';
import styled, { CSSProperties } from 'styled-components';
import { Flex } from '../basic/Flex';
// tslint:disable: react-unused-props-and-state

type Props = {
  label: string;
  value: string;
  active: boolean;
  inputName?: string;
  onClick?: (value: string) => void;
};

const StyledInput = styled.input`
  opacity: 0;
  position: absolute;
  cursor: pointer;
  width: calc(var(--filled-size) + var(--outline-offset));
  height: calc(var(--filled-size) + var(--outline-offset));

  :checked + label:before,
  :hover + label:before {
    background: var(--color-accent);
  }
`;

const StyledLabel = styled.label`
  cursor: pointer;

  :before {
    content: '';
    display: inline-block;
    margin-inline-end: var(--filled-size);
    border-radius: 100%;

    transition: var(--default-duration);
    padding: calc(var(--filled-size) / 2);
    outline-offset: 3px;
    outline: var(--color-text) solid 1px;
    border: none;
    margin-top: var(--filled-size);

    :hover {
      background: var(--color-accent);
    }
  }
`;

export const SessionRadio = (props: Props) => {
  const { label, inputName, value, active, onClick } = props;

  function clickHandler(e: ChangeEvent<any>) {
    if (onClick) {
      // let something else catch the event if our click handler is not set
      e.stopPropagation();
      onClick?.(value);
    }
  }

  return (
    <Flex
      container={true}
      padding="0 0 5px"
      style={
        {
          '--filled-size': '15px',
        } as CSSProperties
      }
    >
      <StyledInput
        type="radio"
        name={inputName || ''}
        value={value}
        aria-checked={active}
        checked={active}
        onChange={clickHandler}
      />

      <StyledLabel role="button" onClick={clickHandler}>
        {label}
      </StyledLabel>
    </Flex>
  );
};
