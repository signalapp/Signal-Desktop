// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ForwardedRef } from 'react';
import React, { forwardRef, useEffect, useLayoutEffect, useRef } from 'react';
import { mergeRefs } from '@react-aria/utils';
import { strictAssert } from '../util/assert';
import type { PropsType } from './Input';
import { Input } from './Input';

export const AutoSizeTextArea = forwardRef(function AutoSizeTextArea(
  props: PropsType,
  ref: ForwardedRef<HTMLTextAreaElement>
): JSX.Element {
  const ownRef = useRef<HTMLTextAreaElement | null>(null);
  const textareaRef = mergeRefs(ownRef, ref);

  function update(textarea: HTMLTextAreaElement) {
    const styles = window.getComputedStyle(textarea);
    const { scrollHeight } = textarea;
    let height = 'calc(';
    height += `${scrollHeight}px`;
    if (styles.boxSizing === 'border-box') {
      height += ` + ${styles.borderTopWidth} + ${styles.borderBottomWidth}`;
    } else {
      height += ` - ${styles.paddingTop} - ${styles.paddingBottom}`;
    }
    height += ')';
    Object.assign(textarea.style, {
      height,
      overflow: 'hidden',
      resize: 'none',
    });
  }

  useEffect(() => {
    strictAssert(ownRef.current, 'inputRef.current should be defined');
    const textarea = ownRef.current;
    function onInput() {
      textarea.style.height = 'auto';
      requestAnimationFrame(() => update(textarea));
    }
    textarea.addEventListener('input', onInput);
    return () => {
      textarea.removeEventListener('input', onInput);
    };
  }, []);

  useLayoutEffect(() => {
    strictAssert(ownRef.current, 'inputRef.current should be defined');
    const textarea = ownRef.current;
    textarea.style.height = 'auto';
    update(textarea);
  }, [props.value]);

  return <Input ref={textareaRef} {...props} forceTextarea />;
});
