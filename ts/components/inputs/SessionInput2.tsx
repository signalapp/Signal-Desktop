import { ChangeEvent, useEffect, useState } from 'react';

import { motion } from 'framer-motion';
import { isEmpty, isEqual } from 'lodash';
import styled from 'styled-components';
import { THEME_GLOBALS } from '../../themes/globals';
import { Noop } from '../../types/Util';
import { useHTMLDirection } from '../../util/i18n';
import { Flex } from '../basic/Flex';
import { SpacerMD } from '../basic/Text';
import { SessionIconButton } from '../icon';

const StyledInputContainer = styled(Flex)<{ error: boolean }>`
  width: 280px;

  label {
    color: var(--text-primary-color);
    opacity: 0;
    transition: opacity var(--default-duration);

    &.filled {
      opacity: 1;
    }

    &.error {
      color: var(--danger-color);
      font-weight: 700;
    }
  }

  input::placeholder {
    transition: opacity var(--default-duration) color var(--default-duration);
    ${props => props.error && `color: var(--danger-color); opacity: 1;`}
  }
`;

const StyledInput = styled(motion.input)`
  border: 1px solid var(--input-border-color);
  border-radius: 13px;
  outline: 0;
  width: 280px;
  background: transparent;
  color: var(--input-text-color);

  font-family: var(--font-default);
  font-size: 12px;
  line-height: 14px;
  padding: var(--margins-lg);

  &::placeholder {
    color: var(--input-text-placeholder-color);
  }
`;

const ErrorItem = (props: { id: string; error: string }) => {
  return (
    <motion.label
      htmlFor={props.id}
      className={'filled error'}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: THEME_GLOBALS['--default-duration-seconds'] }}
    >
      {props.error}
    </motion.label>
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

type Props = {
  error?: string;
  type?: string;
  value?: string;
  placeholder: string;
  maxLength?: number;
  enableShowHide?: boolean;
  onValueChanged?: (value: string) => any;
  onEnterPressed?: (value: string) => any;
  autoFocus?: boolean;
  ref?: any;
  inputDataTestId?: string;
  id?: string;
};

export const SessionInput2 = (props: Props) => {
  const {
    autoFocus,
    placeholder,
    type = 'text',
    value,
    maxLength,
    enableShowHide,
    error,
    onValueChanged,
    inputDataTestId,
    id = 'session-input-floating-label',
  } = props;
  const [inputValue, setInputValue] = useState('');
  const [errorString, setErrorString] = useState('');
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

  // if we have an error, we want to show it even if the input changes to a valid value
  useEffect(() => {
    if (error && !isEmpty(error) && !isEqual(error, errorString)) {
      setErrorString(error);
    }
  }, [error, errorString]);

  return (
    <StyledInputContainer
      container={true}
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
      error={Boolean(errorString)}
    >
      <StyledInput
        id={id}
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
            props.onEnterPressed(inputValue);
            setErrorString('');
          }
        }}
        initial={{
          borderColor: errorString ? 'var(--input-border-color)' : undefined,
        }}
        animate={{
          borderColor: errorString ? 'var(--danger-color)' : undefined,
        }}
        transition={{ duration: THEME_GLOBALS['--default-duration-seconds'] }}
      />

      {enableShowHide && (
        <ShowHideButton
          toggleForceShow={() => {
            setForceShow(!forceShow);
          }}
        />
      )}
      {errorString ? (
        <>
          <SpacerMD />
          <ErrorItem id={id} error={errorString} />
        </>
      ) : null}
    </StyledInputContainer>
  );
};
