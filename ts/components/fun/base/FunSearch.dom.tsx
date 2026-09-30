// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { JSX } from 'react';
import { useCallback, useId } from 'react';
import { getInteractionModality } from '@react-aria/interactions';
import type { LocalizerType } from '../../../types/I18N.std.ts';
import { useFunContext } from '../FunProvider.dom.tsx';
import { AxoSearchField } from '../../../axo/fields/AxoSearchField.dom.tsx';
import { tw } from '../../../axo/tw.dom.tsx';

export type FunSearchProps = Readonly<{
  i18n: LocalizerType;
  label: string;
  placeholder: string;
  searchInput: string;
  maxBytes?: number;
  maxGraphemes?: number;
  onSearchInputChange: (newSearchInput: string) => void;
}>;

export function FunSearch(props: FunSearchProps): JSX.Element {
  const { shouldAutoFocus, onChangeShouldAutoFocus } = useFunContext();
  const id = useId();

  const handleFocus = useCallback(() => {
    onChangeShouldAutoFocus(true);
  }, [onChangeShouldAutoFocus]);

  const handleBlur = useCallback(() => {
    if (getInteractionModality() !== 'pointer') {
      onChangeShouldAutoFocus(false);
    }
  }, [onChangeShouldAutoFocus]);

  return (
    <>
      <label htmlFor={id} className={tw('sr-only')}>
        {props.label}
      </label>
      <AxoSearchField.Root
        id={id}
        value={props.searchInput}
        onValueChange={props.onSearchInputChange}
        maxBytes={props.maxBytes}
        maxGraphemes={props.maxGraphemes}
      >
        <AxoSearchField.Icon />
        <AxoSearchField.Input
          autoFocus={shouldAutoFocus}
          placeholder={props.placeholder}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
        <AxoSearchField.Clear />
      </AxoSearchField.Root>
    </>
  );
}
