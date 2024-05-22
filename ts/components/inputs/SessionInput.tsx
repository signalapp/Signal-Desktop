import { ChangeEvent, ReactNode, useEffect, useState } from 'react';

import { motion } from 'framer-motion';
import { isEmpty, isEqual } from 'lodash';
import styled, { CSSProperties } from 'styled-components';
import { THEME_GLOBALS } from '../../themes/globals';
import { useHTMLDirection } from '../../util/i18n';
import { AnimatedFlex, Flex } from '../basic/Flex';
import { SpacerMD } from '../basic/Text';
import { SessionIconButton } from '../icon';

type TextSizes = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const StyledSessionInput = styled(Flex)<{
  error: boolean;
  fontSize?: TextSizes;
}>`
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
    props.fontSize &&
    `
  ${StyledInput} {
    font-size: var(--font-size-${props.fontSize});
  }

  ${StyledTextAreaContainer} {
    font-size: var(--font-size-${props.fontSize});

    textarea {
      &:placeholder-shown {
        font-size: var(--font-size-${props.fontSize});
      }
    }
  }
  `}
`;

const StyledBorder = styled(AnimatedFlex)`
  position: relative;
  border: 1px solid var(--input-border-color);
  border-radius: 13px;
`;

const StyledInput = styled(motion.input)<{
  error: boolean;
  centerText?: boolean;
  monospaced?: boolean;
}>`
  outline: 0;
  border: none;
  width: 100%;
  padding: var(--margins-lg);
  background: transparent;
  color: ${props => (props.error ? 'var(--danger-color)' : 'var(--input-text-color)')};

  font-family: ${props => (props.monospaced ? 'var(--font-mono)' : 'var(--font-default)')};
  font-size: 12px;
  line-height: 1.4;
  ${props => props.centerText && 'text-align: center;'}

  &::placeholder {
    color: var(--input-text-placeholder-color);
    ${props => props.centerText && 'text-align: center;'}
  }
`;

const StyledTextAreaContainer = styled(motion.div)<{
  error: boolean;
  centerText?: boolean;
  fontSize?: TextSizes;
  monospaced?: boolean;
}>`
  overflow: hidden;
  position: relative;
  height: ${props => (props.fontSize ? `calc(var(--font-size-${props.fontSize}) * 4)` : '48px')};
  width: 100%;
  margin: var(--margins-sm) var(--margins-md);

  background: transparent;
  color: ${props => (props.error ? 'var(--danger-color)' : 'var(--input-text-color)')};
  outline: 0;

  font-family: ${props => (props.monospaced ? 'var(--font-mono)' : 'var(--font-default)')};
  font-size: 12px;
  line-height: 1.4;

  ${props => props.centerText && 'text-align: center;'}

  textarea {
    display: flex;
    height: 100%;
    width: 100%;
    padding: 0;
    outline: 0;
    border: none;
    background: transparent;

    position: absolute;
    top: ${props =>
      props.fontSize ? `calc(var(--font-size-${props.fontSize}) + 5px)` : 'calc(12px + 5px)'};

    resize: none;
    overflow-wrap: break-word;
    user-select: all;

    ${props => props.centerText && 'text-align: center;'}

    &:placeholder-shown {
      font-family: ${props => (props.monospaced ? 'var(--font-mono)' : 'var(--font-default)')};
      font-size: 12px;
      line-height: 1.4;
    }

    &::placeholder {
      color: var(--input-text-placeholder-color);
      ${props => props.centerText && 'text-align: center;'}
    }
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

const ShowHideButton = (props: {
  forceShow: boolean;
  toggleForceShow: () => void;
  error: boolean;
}) => {
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
  // TODO rename disableOnBlurEvent
  disabledOnBlur?: boolean;
  inputRef?: any;
  inputDataTestId?: string;
  id?: string;
  ctaButton?: ReactNode;
  monospaced?: boolean;
  fontSize?: TextSizes;
  centerText?: boolean;
  editable?: boolean;
  isTextArea?: boolean;
  required?: boolean;
  tabIndex?: number;
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
    inputRef,
    inputDataTestId,
    id = 'session-input-floating-label',
    ctaButton,
    monospaced,
    fontSize,
    centerText,
    editable = true,
    isTextArea,
    required,
    tabIndex,
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

  // TODO[epic=ses-893] Type inputProps properly
  const inputProps: any = {
    id,
    type: correctType,
    placeholder,
    value,
    disabled: !editable,
    maxLength,
    autoFocus,
    'data-testid': inputDataTestId,
    required,
    'aria-required': required,
    tabIndex,
    ref: inputRef,
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
        if (isTextArea && event.shiftKey) {
          return;
        }
        event.preventDefault();
        onEnterPressed(inputValue);
        setErrorString('');
      }
    },
  };

  const containerProps = {
    error: Boolean(error),
    centerText,
    fontSize,
    monospaced,
  };

  // if we have an error, we want to show it even if the input changes to a valid value
  useEffect(() => {
    if (error && !isEmpty(error) && !isEqual(error, errorString)) {
      setErrorString(error);
    }
  }, [error, errorString]);

  return (
    <StyledSessionInput
      className={className}
      container={true}
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
      error={Boolean(errorString)}
      fontSize={fontSize}
    >
      <StyledBorder
        container={true}
        width="100%"
        alignItems="center"
        initial={{
          borderColor: errorString ? 'var(--input-border-color)' : undefined,
        }}
        animate={{
          borderColor: errorString ? 'var(--danger-color)' : undefined,
        }}
        transition={{ duration: THEME_GLOBALS['--default-duration-seconds'] }}
      >
        {isTextArea ? (
          <StyledTextAreaContainer {...containerProps}>
            <textarea {...inputProps} />
          </StyledTextAreaContainer>
        ) : (
          <StyledInput {...inputProps} {...containerProps} />
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
      </StyledBorder>

      {ctaButton || errorString ? <SpacerMD /> : null}
      {errorString ? <ErrorItem id={id} error={errorString} /> : null}

      <StyledCtaContainer
        initial={{ y: errorString && ctaButton ? 0 : undefined }}
        animate={{ y: errorString && ctaButton ? 'var(--margins-md)' : undefined }}
      >
        {ctaButton}
      </StyledCtaContainer>
    </StyledSessionInput>
  );
};
