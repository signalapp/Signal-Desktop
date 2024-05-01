import React, { useState } from 'react';

import classNames from 'classnames';
import { SessionIconButton } from '../icon';
import { useHTMLDirection } from '../../util/i18n';

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

const LabelItem = (props: { inputValue: string; label?: string }) => {
  return (
    <label
      htmlFor="session-input-floating-label"
      className={classNames(
        props.inputValue !== ''
          ? 'session-input-with-label-container filled'
          : 'session-input-with-label-container'
      )}
    >
      {props.label}
    </label>
  );
};

const ErrorItem = (props: { error: string | undefined }) => {
  return (
    <label
      htmlFor="session-input-floating-label"
      className={classNames('session-input-with-label-container filled error')}
    >
      {props.error}
    </label>
  );
};

const ShowHideButton = (props: { toggleForceShow: () => void }) => {
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

export const SessionInput = (props: Props) => {
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

  const updateInputValue = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    const val = e.target.value;
    setInputValue(val);
    if (onValueChanged) {
      onValueChanged(val);
    }
  };

  return (
    <div className="session-input-with-label-container">
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
        className={classNames(enableShowHide ? 'session-input-floating-label-show-hide' : '')}
        // just in case onChange isn't triggered
        onBlur={updateInputValue}
        onKeyPress={event => {
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
      <hr />
    </div>
  );
};
