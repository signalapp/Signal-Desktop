import React, { ChangeEvent, KeyboardEvent, useRef } from 'react';
import classNames from 'classnames';
import { useFocusMount } from '../../hooks/useFocusMount';

type Props = {
  placeholder?: string;
  value?: string;
  text?: string;
  editable?: boolean;
  onChange?: (value: string) => void;
  onPressEnter?: any;
  maxLength?: number;
  isGroup?: boolean;
  dataTestId?: string;
};

export const SessionIdEditable = (props: Props) => {
  const {
    placeholder,
    onPressEnter,
    onChange,
    editable,
    text,
    value,
    maxLength,
    isGroup,
    dataTestId,
  } = props;
  const inputRef = useRef(null);

  useFocusMount(inputRef, editable);
  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    if (editable && onChange) {
      const eventValue = e.target.value?.replace(/(\r\n|\n|\r)/gm, '');
      onChange(eventValue);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (editable && e.key === 'Enter') {
      e.preventDefault();

      onPressEnter?.();
    }
  }

  return (
    <div className={classNames('session-id-editable', !editable && 'session-id-editable-disabled')}>
      <textarea
        className={classNames(
          isGroup ? 'group-id-editable-textarea' : 'session-id-editable-textarea'
        )}
        ref={inputRef}
        placeholder={placeholder}
        disabled={!editable}
        spellCheck={false}
        onKeyDown={handleKeyDown}
        onChange={handleChange}
        onBlur={handleChange}
        value={value || text}
        maxLength={maxLength}
        data-testid={dataTestId}
      />
    </div>
  );
};
