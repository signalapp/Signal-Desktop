import React from 'react';
import styled, { CSSProperties } from 'styled-components';
import { Flex } from '../basic/Flex';
// tslint:disable: react-unused-props-and-state

type Props = {
  label: string;
  value: string;
  active: boolean;
  inputName?: string;
  onClick: (value: string) => void;
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
    width: var(--filled-size);
    height: var(--filled-size);
    margin-inline-end: var(--margin-end);
    border-radius: 100%;

    transition: var(--default-duration);
    padding: 7px;
    outline-offset: var(--outline-offset);
    outline: var(--color-text) solid 1px;
    border: none;
    margin-top: 5px;

    :hover {
      background: var(--color-accent);
    }
  }
`;

export const SessionRadio = (props: Props) => {
  const { label, inputName, value, active, onClick } = props;

  function clickHandler(e: any) {
    e.stopPropagation();
    onClick(value);
  }

  return (
    <Flex
      container={true}
      padding="0 0 5px"
      style={
        {
          '--filled-size': '15px',
          '--margin-end': '1rem',
          '--outline-offset': '3px',
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

export const SessionRadioInput = (
  props: Pick<Props, 'active' | 'inputName' | 'onClick' | 'value'>
) => {
  const { active, onClick, inputName, value } = props;
  function clickHandler(e: any) {
    e.stopPropagation();
    onClick(value);
  }

  return (
    <StyledInput
      type="radio"
      name={inputName || ''}
      value={value}
      aria-checked={active}
      checked={active}
      onChange={clickHandler}
    />
  );
};
