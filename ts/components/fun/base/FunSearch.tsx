// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { useCallback } from 'react';
import { VisuallyHidden } from 'react-aria';
import type { LocalizerType } from '../../../types/I18N';

export type FunSearchProps = Readonly<{
  i18n: LocalizerType;
  'aria-label': string;
  placeholder: string;
  searchInput: string;
  onSearchInputChange: (newSearchInput: string) => void;
}>;

export function FunSearch(props: FunSearchProps): JSX.Element {
  const { i18n, onSearchInputChange } = props;

  const handleChange = useCallback(
    event => {
      onSearchInputChange(event.target.value);
    },
    [onSearchInputChange]
  );

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
        placeholder={props.placeholder}
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
