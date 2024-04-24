import { ChangeEvent, ReactNode, useEffect, useState } from 'react';

import { motion } from 'framer-motion';
import { isEmpty, isEqual } from 'lodash';
import styled, { CSSProperties } from 'styled-components';
import { THEME_GLOBALS } from '../../themes/globals';
import { Noop } from '../../types/Util';
import { useHTMLDirection } from '../../util/i18n';
import { Flex } from '../basic/Flex';
import { SpacerMD } from '../basic/Text';
import { SessionIconButton } from '../icon';

const StyledInput = styled(motion.input)<{ centerText?: boolean }>`
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
  ${props => props.centerText && 'text-align: center;'}

  ::placeholder {
    color: var(--input-text-placeholder-color);
    ${props => props.centerText && 'text-align: center;'}
  }
`;

const StyledTextAreaContainer = styled(motion.div)<{ centerText?: boolean }>`
  border: 1px solid var(--input-border-color);
  border-radius: 13px;
  outline: 0;
  width: 100%;
  min-height: 100px;
  background: transparent;
  color: var(--input-text-color);

  font-family: var(--font-mono);
  font-size: var(--font-size-md);
  line-height: 18px;

  ${props => props.centerText && 'text-align: center;'}

  textarea {
    width: 100%;
    outline: 0;
    border: none;
    background: transparent;

    resize: none;
    overflow: hidden;
    overflow-wrap: break-word;
    user-select: all;

    display: inline-block;
    padding: var(--margins-lg);
    margin: var(--margins-xs) 0;

    ${props => props.centerText && 'text-align: center;'}

    :placeholder-shown {
      font-family: var(--font-default);
      height: 28px;
      margin: var(--margins-md) 0;
      padding: var(--margins-xl);
    }

    ::placeholder {
      color: var(--input-text-placeholder-color);
      ${props => props.centerText && 'text-align: center;'}
    }
  }
`;

const StyledInputContainer = styled(Flex)<{ error: boolean; isGroup?: boolean }>`
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

  input::placeholder,
  textarea::placeholder {
    transition: opacity var(--default-duration) color var(--default-duration);
    ${props => props.error && `color: var(--danger-color); opacity: 1;`}
  }

  ${props =>
    props.isGroup &&
    `
    ${StyledInput} {
      font-family: var(--font-mono);
      font-size: var(--font-size-md);
      line-height: 18px;
    }

    ${StyledTextAreaContainer} {
      font-family: var(--font-mono);
      font-size: var(--font-size-md);
      line-height: 18px;

      textarea {
        :placeholder-shown {
          font-family: var(--font-mono);
        }
      }
    }
  `}
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
  const style: CSSProperties = {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    left: htmlDirection === 'ltr' ? undefined : 'var(--margins-sm)',
    right: htmlDirection === 'ltr' ? 'var(--margins-sm)' : undefined,
  };

  if (props.forceShow) {
    return (
      <SessionIconButton
        iconType={'eyeDisabled'}
        iconColor={props.error ? 'var(--danger-color)' : 'var(--text-primary-color)'}
        iconSize="huge"
        onClick={props.toggleForceShow}
        style={style}
        dataTestId="reveal-recovery-phrase-toggle"
      />
    );
  }

  return (
    <SessionIconButton
      iconType={'eye'}
      iconColor={props.error ? 'var(--danger-color)' : 'var(--text-primary-color)'}
      iconSize="huge"
      onClick={props.toggleForceShow}
      style={style}
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
  placeholder?: string;
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
  /** Font is larger and monospaced */
  isGroup?: boolean;
  /** Gives us a textarea with a monospace font. Mostly used for joining conversations, groups or communities */
  isSpecial?: boolean;
  centerText?: boolean;
  editable?: boolean;
  className?: string;
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
    isGroup,
    isSpecial,
    centerText,
    editable = true,
    className,
  } = props;
  const [inputValue, setInputValue] = useState('');
  const [errorString, setErrorString] = useState('');
  const [forceShow, setForceShow] = useState(false);

  const correctType = forceShow ? 'text' : type;

  const updateInputValue = (e: ChangeEvent<HTMLInputElement>) => {
    if (!editable) {
      return;
    }
    e.preventDefault();
    const val = e.target.value;
    setInputValue(val);
    if (onValueChanged) {
      onValueChanged(val);
    }
  };

  // TODO[epic=893] Type inputProps properly
  const inputProps: any = {
    id,
    type: correctType,
    placeholder,
    value,
    disabled: !editable,
    maxLength,
    autoFocus,
    'data-testid': inputDataTestId,
    onChange: updateInputValue,
    style: { paddingInlineEnd: enableShowHide ? '48px' : undefined },
    // just in case onChange isn't triggered
    onBlur: (event: ChangeEvent<HTMLInputElement>) => {
      if (editable && !disabledOnBlur) {
        updateInputValue(event);
      }
    },
    onKeyDown: (event: KeyboardEvent) => {
      if (!editable) {
        return;
      }
      if (event.key === 'Enter' && onEnterPressed) {
        if (isSpecial && event.shiftKey) {
          return;
        }
        event.preventDefault();
        onEnterPressed(inputValue);
        setErrorString('');
      }
    },
    initial: {
      borderColor: errorString ? 'var(--input-border-color)' : undefined,
    },
    animate: {
      borderColor: errorString ? 'var(--danger-color)' : undefined,
    },
    transition: { duration: THEME_GLOBALS['--default-duration-seconds'] },
  };

  // if we have an error, we want to show it even if the input changes to a valid value
  useEffect(() => {
    if (error && !isEmpty(error) && !isEqual(error, errorString)) {
      setErrorString(error);
    }
  }, [error, errorString]);

  return (
    <StyledInputContainer
      className={className}
      container={true}
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
      error={Boolean(errorString)}
      isGroup={isGroup}
    >
      <Flex container={true} width="100%" alignItems="center" style={{ position: 'relative' }}>
        {isSpecial ? (
          <StyledTextAreaContainer centerText={centerText}>
            <textarea {...inputProps} />
          </StyledTextAreaContainer>
        ) : (
          <StyledInput {...inputProps} centerText={centerText} />
        )}
        {editable && enableShowHide && (
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
