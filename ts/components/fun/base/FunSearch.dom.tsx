// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ChangeEvent } from 'react';
import React, { useCallback } from 'react';
import { VisuallyHidden } from 'react-aria';
import { getInteractionModality } from '@react-aria/interactions';
import type { LocalizerType } from '../../../types/I18N.std.js';
import { useFunContext } from '../FunProvider.dom.js';

export type FunSearchProps = Readonly<{
  i18n: LocalizerType;
  'aria-label': string;
  placeholder: string;
  searchInput: string;
  onSearchInputChange: (newSearchInput: string) => void;
}>;

export function FunSearch(props: FunSearchProps): JSX.Element {
  const { i18n, onSearchInputChange } = props;
  const { shouldAutoFocus, onChangeShouldAutoFocus } = useFunContext();

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      onSearchInputChange(event.currentTarget.value);
    },
    [onSearchInputChange]
  );

  const handleFocus = useCallback(() => {
    onChangeShouldAutoFocus(true);
  }, [onChangeShouldAutoFocus]);

  const handleBlur = useCallback(() => {
    if (getInteractionModality() !== 'pointer') {
      onChangeShouldAutoFocus(false);
    }
  }, [onChangeShouldAutoFocus]);

  const handleClear = useCallback(() => {
    onSearchInputChange('');
  }, [onSearchInputChange]);

  return (
    <div className="FunSearch__Container">
      <div className="FunSearch__Icon" />
      <input
        className="FunSearch__Input"
        aria-label={props['aria-label']}
        type="text"
        value={props.searchInput}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={props.placeholder}
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus={shouldAutoFocus}
      />
      {props.searchInput !== '' && (
        <button
          type="button"
          className="FunSearch__Clear"
          onClick={handleClear}
        >
          <span className="FunSearch__ClearButton">
            <VisuallyHidden>
              {i18n('icu:FunSearch__ClearButtonLabel')}
            </VisuallyHidden>
          </span>
        </button>
      )}
    </div>
  );
}
