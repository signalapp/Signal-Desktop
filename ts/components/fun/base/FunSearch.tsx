// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { useCallback } from 'react';

export type FunSearchProps = Readonly<{
  'aria-label': string;
  placeholder: string;
  searchInput: string;
  onSearchInputChange: (newSearchInput: string) => void;
}>;

export function FunSearch(props: FunSearchProps): JSX.Element {
  const { onSearchInputChange } = props;
  const handleChange = useCallback(
    event => {
      onSearchInputChange(event.target.value);
    },
    [onSearchInputChange]
  );

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
    </div>
  );
}
