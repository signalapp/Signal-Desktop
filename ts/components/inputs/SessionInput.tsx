import { ChangeEvent, ReactNode, useEffect, useState } from 'react';

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
  position: relative;
  width: 100%;

  label {
    color: var(--text-primary-color);
    opacity: 0;
    transition: opacity var(--default-duration);
    text-align: center;

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
  width: 100%;
  background: transparent;
  color: var(--input-text-color);

  font-family: var(--font-default);
  font-size: 12px;
  line-height: 14px;
  padding: var(--margins-lg);

  ::placeholder {
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
      data-testid="session-error-message"
    >
      {props.error}
    </motion.label>
  );
};

const ShowHideButton = (props: { forceShow: boolean; toggleForceShow: Noop; error: boolean }) => {
  const htmlDirection = useHTMLDirection();
  const position =
    htmlDirection === 'ltr' ? { right: 'var(--margins-md)' } : { left: 'var(--margins-md)' };

  if (props.forceShow) {
    return (
      <SessionIconButton
        iconType={'eyeDisabled'}
        iconColor={props.error ? 'var(--danger-color)' : 'var(--text-primary-color)'}
        iconSize="huge"
        iconPadding="1.25px"
        padding={'0'}
        onClick={props.toggleForceShow}
        style={{
          marginTop: '-0.5px',
          marginRight: '0.25px',
          position: 'absolute',
          top: '50%',
          transform: 'translateY(-50%)',
          ...position,
        }}
        dataTestId="reveal-recovery-phrase-toggle"
      />
    );
  }

  return (
    <SessionIconButton
      iconType={'eye'}
      iconColor={props.error ? 'var(--danger-color)' : 'var(--text-primary-color)'}
      iconSize="medium"
      onClick={props.toggleForceShow}
      style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', ...position }}
      dataTestId="reveal-recovery-phrase-toggle"
    />
  );
};

const StyledCtaContainer = styled(motion.div)`
  width: 100%;
`;

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
  disabledOnBlur?: boolean;
  ref?: any;
  inputDataTestId?: string;
  id?: string;
  ctaButton?: ReactNode;
};

export const SessionInput = (props: Props) => {
  const {
    placeholder,
    type = 'text',
    value,
    maxLength,
    enableShowHide,
    error,
    onValueChanged,
    onEnterPressed,
    autoFocus,
    disabledOnBlur,
    inputDataTestId,
    id = 'session-input-floating-label',
    ctaButton,
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
      <Flex container={true} width="100%" alignItems="center" style={{ position: 'relative' }}>
        <StyledInput
          id={id}
          type={correctType}
          placeholder={placeholder}
          value={value}
          maxLength={maxLength}
          autoFocus={autoFocus}
          data-testid={inputDataTestId}
          onChange={updateInputValue}
          style={{ paddingInlineEnd: enableShowHide ? '48px' : undefined }}
          // just in case onChange isn't triggered
          onBlur={(event: ChangeEvent<HTMLInputElement>) => {
            if (!disabledOnBlur) {
              updateInputValue(event);
            }
          }}
          onKeyDown={event => {
            if (event.key === 'Enter' && onEnterPressed) {
              onEnterPressed(inputValue);
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
            forceShow={forceShow}
            toggleForceShow={() => {
              setForceShow(!forceShow);
            }}
            error={Boolean(errorString)}
          />
        )}
      </Flex>

      {ctaButton || errorString ? <SpacerMD /> : null}
      {errorString ? <ErrorItem id={id} error={errorString} /> : null}

      <StyledCtaContainer
        initial={{ y: errorString && ctaButton ? 0 : undefined }}
        animate={{ y: errorString && ctaButton ? 'var(--margins-md)' : undefined }}
      >
        {ctaButton}
      </StyledCtaContainer>
    </StyledInputContainer>
  );
};
