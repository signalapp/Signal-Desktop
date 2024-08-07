import { ChangeEvent, ReactNode, RefObject, useEffect, useRef, useState } from 'react';

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
  textSize: TextSizes;
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
      user-select: text;
    }
  }

  input::placeholder,
  textarea::placeholder {
    transition: opacity var(--default-duration) color var(--default-duration);
    ${props => props.error && `color: var(--danger-color); opacity: 1;`}
  }

  ${props =>
    props.textSize &&
    `
  ${StyledInput} {
    font-size: var(--font-size-${props.textSize});
  }

  ${StyledTextAreaContainer} {
    font-size: var(--font-size-${props.textSize});

    textarea {
      &:placeholder-shown {
        font-size: var(--font-size-${props.textSize});
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
  textSize: TextSizes;
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
  line-height: 1.4;
  ${props => props.centerText && 'text-align: center;'}
  ${props => `font-size: var(--font-size-${props.textSize});`}

  &::placeholder {
    color: var(--input-text-placeholder-color);
    ${props => props.centerText && 'text-align: center;'}
  }
`;

export const StyledTextAreaContainer = styled(motion.div)<{
  noValue: boolean;
  error: boolean;
  textSize: TextSizes;
  centerText?: boolean;
  monospaced?: boolean;
}>`
  display: flex;
  align-items: center;
  overflow: hidden;
  position: relative;
  height: ${props => (props.textSize ? `calc(var(--font-size-${props.textSize}) * 4)` : '48px')};
  width: 100%;
  margin: var(--margins-sm) var(--margins-md);

  background: transparent;
  color: ${props => (props.error ? 'var(--danger-color)' : 'var(--input-text-color)')};
  outline: 0;

  font-family: ${props => (props.monospaced ? 'var(--font-mono)' : 'var(--font-default)')};
  ${props => `font-size: var(--font-size-${props.textSize});`}
  line-height: 1;

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
      `calc(var(--font-size-${props.textSize}) + ${props.textSize === 'xl' ? '8px' : '5px'})`};

    resize: none;
    word-break: break-all;
    user-select: all;

    ${props => props.centerText && 'text-align: center;'}

    &:placeholder-shown {
      font-family: ${props => (props.monospaced ? 'var(--font-mono)' : 'var(--font-default)')};
      ${props => `font-size: var(--font-size-${props.textSize});`}
      line-height: 1;
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
      aria-label="Error message"
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

type ShowHideButtonStrings = { hide: string; show: string };
type ShowHideButtonProps = {
  forceShow: boolean;
  toggleForceShow: () => void;
  error: boolean;
  ariaLabels?: ShowHideButtonStrings;
  dataTestIds?: ShowHideButtonStrings;
};

const ShowHideButton = (props: ShowHideButtonProps) => {
  const {
    forceShow,
    toggleForceShow,
    error,
    ariaLabels = { hide: 'Hide input text button', show: 'Show input text button' },
    dataTestIds = { hide: 'hide-input-text-toggle', show: 'show-input-text-toggle' },
  } = props;

  const htmlDirection = useHTMLDirection();
  const style: CSSProperties = {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    left: htmlDirection === 'ltr' ? undefined : 'var(--margins-sm)',
    right: htmlDirection === 'ltr' ? 'var(--margins-sm)' : undefined,
  };

  if (forceShow) {
    return (
      <SessionIconButton
        ariaLabel={ariaLabels.hide}
        iconType={'eyeDisabled'}
        iconColor={error ? 'var(--danger-color)' : 'var(--text-primary-color)'}
        iconSize="huge"
        onClick={toggleForceShow}
        style={style}
        dataTestId={dataTestIds.hide}
      />
    );
  }

  return (
    <SessionIconButton
      ariaLabel={ariaLabels.show}
      iconType={'eye'}
      iconColor={props.error ? 'var(--danger-color)' : 'var(--text-primary-color)'}
      iconSize="huge"
      onClick={toggleForceShow}
      style={style}
      dataTestId={dataTestIds.show}
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
  ariaLabel?: string;
  maxLength?: number;
  onValueChanged?: (value: string) => any;
  onEnterPressed?: (value: string) => any;
  autoFocus?: boolean;
  disableOnBlurEvent?: boolean;
  inputRef?: RefObject<HTMLInputElement | HTMLTextAreaElement>;
  inputDataTestId?: string;
  id?: string;
  enableShowHideButton?: boolean;
  showHideButtonAriaLabels?: ShowHideButtonStrings;
  showHideButtonDataTestIds?: ShowHideButtonStrings;
  ctaButton?: ReactNode;
  monospaced?: boolean;
  textSize?: TextSizes;
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
    ariaLabel,
    maxLength,
    error,
    onValueChanged,
    onEnterPressed,
    autoFocus,
    disableOnBlurEvent,
    inputRef,
    inputDataTestId,
    id = 'session-input-floating-label',
    enableShowHideButton,
    showHideButtonAriaLabels,
    showHideButtonDataTestIds,
    ctaButton,
    monospaced,
    textSize = 'sm',
    centerText,
    editable = true,
    isTextArea,
    required,
    tabIndex,
    className,
  } = props;
  const [inputValue, setInputValue] = useState('');
  const [errorString, setErrorString] = useState('');
  const [textErrorStyle, setTextErrorStyle] = useState(false);
  const [forceShow, setForceShow] = useState(false);

  const textAreaRef = useRef(inputRef?.current || null);

  const correctType = forceShow ? 'text' : type;

  const updateInputValue = (e: ChangeEvent<HTMLInputElement>) => {
    if (!editable) {
      return;
    }
    e.preventDefault();
    const val = e.target.value;
    setInputValue(val);
    setTextErrorStyle(false);
    if (isTextArea && textAreaRef && textAreaRef.current !== null) {
      const scrollHeight = `${textAreaRef.current.scrollHeight}px`;
      if (isEmpty(val)) {
        // resets the height of the text area so it's centered if we clear the text
        textAreaRef.current.style.height = 'unset';
      }
      if (scrollHeight !== textAreaRef.current.style.height) {
        textAreaRef.current.style.height = `${textAreaRef.current.scrollHeight}px`;
      }
    }
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
    textSize,
    disabled: !editable,
    maxLength,
    autoFocus,
    'data-testid': inputDataTestId,
    required,
    'aria-required': required,
    tabIndex,
    onChange: updateInputValue,
    style: { paddingInlineEnd: enableShowHideButton ? '48px' : undefined },
    // just in case onChange isn't triggered
    onBlur: (event: ChangeEvent<HTMLInputElement>) => {
      if (editable && !disableOnBlurEvent) {
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
    noValue: isEmpty(value),
    error: textErrorStyle,
    centerText,
    textSize,
    monospaced,
  };

  // if we have an error, we want to show it even if the input changes to a valid value
  useEffect(() => {
    if (error && !isEmpty(error) && !isEqual(error, errorString)) {
      setErrorString(error);
      setTextErrorStyle(!!error);
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
      textSize={textSize}
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
            <textarea
              {...inputProps}
              ref={inputRef || textAreaRef}
              aria-label={ariaLabel || 'session input text area'}
            />
          </StyledTextAreaContainer>
        ) : (
          <StyledInput
            {...inputProps}
            {...containerProps}
            ref={inputRef}
            aria-label={ariaLabel || 'session input'}
          />
        )}
        {editable && enableShowHideButton && (
          <ShowHideButton
            forceShow={forceShow}
            toggleForceShow={() => {
              setForceShow(!forceShow);
            }}
            error={Boolean(errorString)}
            ariaLabels={showHideButtonAriaLabels}
            dataTestIds={showHideButtonDataTestIds}
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
