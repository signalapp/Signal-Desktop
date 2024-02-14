import { ChangeEvent, useState } from 'react';

import classNames from 'classnames';
import styled from 'styled-components';
import { Noop } from '../../types/Util';
import { useHTMLDirection } from '../../util/i18n';
import { SessionIconButton } from '../icon';

type Props = {
  label?: string;
  error?: string;
  type?: string;
  value?: string;
  placeholder: string;
  maxLength?: number;
  enableShowHide?: boolean;
  onValueChanged?: (value: string) => any;
  onEnterPressed?: any;
  autoFocus?: boolean;
  ref?: any;
  inputDataTestId?: string;
};

const StyledInputWithLabelContainer = styled.label`
  height: 46.5px;
  width: 280px;
  font-family: var(--font-default);
  color: var(--text-primary-color);

  padding: 2px 0 2px 0;
  transition: opacity var(--default-duration);
  opacity: 1;
  position: relative;

  label {
    line-height: 14px;
    opacity: 0;
    color: var(--text-primary-color);

    font-size: 10px;
    line-height: 11px;
    position: absolute;
    top: 0px;
  }

  &.filled {
    opacity: 1;
  }

  &.error {
    color: var(--danger-color);
  }

  input {
    border: none;
    outline: 0;
    height: 14px;
    width: 280px;
    background: transparent;
    color: var(--input-text-color);

    font-family: var(--font-default);
    font-size: 12px;
    line-height: 14px;
    position: absolute;
    top: 50%;
    transform: translateY(-50%);

    &::placeholder {
      color: var(--input-text-placeholder-color);
    }
  }
`;

const LabelItem = (props: { inputValue: string; label?: string }) => {
  return (
    <StyledInputWithLabelContainer
      htmlFor="session-input-floating-label"
      className={classNames(props.inputValue !== '' ? 'filled' : '')}
    >
      {props.label}
    </StyledInputWithLabelContainer>
  );
};

const ErrorItem = (props: { error: string | undefined }) => {
  return (
    <StyledInputWithLabelContainer
      htmlFor="session-input-floating-label"
      className={classNames('filled error')}
    >
      {props.error}
    </StyledInputWithLabelContainer>
  );
};

const ShowHideButton = (props: { toggleForceShow: Noop }) => {
  const htmlDirection = useHTMLDirection();
  const position = htmlDirection === 'ltr' ? { right: '0px' } : { left: '0px' };

  return (
    <SessionIconButton
      iconType="eye"
      iconSize="medium"
      onClick={props.toggleForceShow}
      style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', ...position }}
    />
  );
};

export const SessionInput2 = (props: Props) => {
  const {
    autoFocus,
    placeholder,
    type,
    value,
    maxLength,
    enableShowHide,
    error,
    label,
    onValueChanged,
    inputDataTestId,
  } = props;
  const [inputValue, setInputValue] = useState('');
  const [forceShow, setForceShow] = useState(false);

  const correctType = forceShow ? 'text' : type;

  const updateInputValue = (e: ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    const val = e.target.value;
    setInputValue(val);
    if (onValueChanged) {
      onValueChanged(val);
    }
  };

  return (
    <StyledInputWithLabelContainer>
      {error ? (
        <ErrorItem error={props.error} />
      ) : (
        <LabelItem inputValue={inputValue} label={label} />
      )}
      <input
        id="session-input-floating-label"
        type={correctType}
        placeholder={placeholder}
        value={value}
        maxLength={maxLength}
        autoFocus={autoFocus}
        data-testid={inputDataTestId}
        onChange={updateInputValue}
        style={{ paddingInlineEnd: enableShowHide ? '30px' : undefined }}
        // just in case onChange isn't triggered
        onBlur={updateInputValue}
        onKeyDown={event => {
          if (event.key === 'Enter' && props.onEnterPressed) {
            props.onEnterPressed();
          }
        }}
      />

      {enableShowHide && (
        <ShowHideButton
          toggleForceShow={() => {
            setForceShow(!forceShow);
          }}
        />
      )}
    </StyledInputWithLabelContainer>
  );
};
