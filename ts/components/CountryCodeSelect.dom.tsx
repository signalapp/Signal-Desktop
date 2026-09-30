// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import {
  useState,
  useCallback,
  useMemo,
  type JSX,
  type MouseEvent,
} from 'react';
import Fuse from 'fuse.js';

import type { LocalizerType } from '../types/Util.std.ts';
import type { CountryDataType } from '../util/getCountryData.dom.ts';
import { AxoDialog } from '../axo/AxoDialog.dom.tsx';
import { AxoSearchField } from '../axo/fields/AxoSearchField.dom.tsx';
import { AxoList } from '../axo/items/AxoList.dom.tsx';
import { AxoItem } from '../axo/items/AxoItem.dom.tsx';
import { AxoClickableItem } from '../axo/items/AxoClickableItem.dom.tsx';

export type PropsType = Readonly<{
  i18n: LocalizerType;
  onChange: (region: string) => void;
  value: string;
  defaultRegion: string;
  countries: ReadonlyArray<CountryDataType>;
}>;

export function CountryCodeSelect({
  i18n,
  onChange,
  value,
  defaultRegion,
  countries,
}: PropsType): JSX.Element {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const selectedCountry = useMemo(() => {
    return countries.find(({ region }) => region === value);
  }, [countries, value]);

  const defaultCode = useMemo(() => {
    return countries.find(({ region }) => region === defaultRegion)?.code ?? '';
  }, [countries, defaultRegion]);

  const onShowModal = useCallback((ev: MouseEvent) => {
    ev.preventDefault();
    setIsModalOpen(true);
  }, []);

  const onCloseModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  return (
    <>
      <button type="button" className="CountryCodeSelect" onClick={onShowModal}>
        <div className="CountryCodeSelect__text">
          {selectedCountry?.displayName ??
            i18n('icu:CountryCodeSelect__placeholder')}
        </div>
        <div className="CountryCodeSelect__value">
          {selectedCountry?.code ?? defaultCode}
        </div>
        <div className="CountryCodeSelect__arrow" />
      </button>
      {isModalOpen ? (
        <ChooseCountryCodeModal
          countries={countries}
          i18n={i18n}
          onChange={onChange}
          onClose={onCloseModal}
        />
      ) : null}
    </>
  );
}

export function ChooseCountryCodeModal({
  countries,
  i18n,
  onChange,
  onClose,
}: {
  countries: ReadonlyArray<CountryDataType>;
  i18n: LocalizerType;
  onChange: (region: string) => void;
  onClose: () => unknown;
}): JSX.Element {
  const index = useMemo(() => {
    return new Fuse<CountryDataType>(countries, {
      keys: [
        {
          name: 'displayName',
          weight: 1,
        },
        {
          name: 'code',
          weight: 0.5,
        },
      ],
      threshold: 0.1,
    });
  }, [countries]);

  const [searchTerm, setSearchTerm] = useState('');
  const filteredCountries = useMemo(() => {
    if (!searchTerm) {
      return countries;
    }
    return index.search(searchTerm).map(({ item }) => item);
  }, [countries, index, searchTerm]);

  const onSearchTermChange = useCallback((value: string) => {
    setSearchTerm(value);
  }, []);

  const onCountryClick = useCallback(
    (region: string) => {
      onClose();
      onChange(region);
    },
    [onChange, onClose]
  );

  return (
    <AxoDialog.Root
      open
      onOpenChange={value => {
        if (!value) {
          onClose();
        }
      }}
    >
      <AxoDialog.Content
        size="md"
        escape="cancel-is-noop"
        disableMissingAriaDescriptionWarning
      >
        <AxoDialog.Header>
          <AxoDialog.Title>
            {i18n('icu:CountryCodeSelect__Modal__title')}
          </AxoDialog.Title>
          <AxoDialog.Close />
        </AxoDialog.Header>
        <AxoDialog.Search>
          <AxoSearchField.Root
            value={searchTerm}
            onValueChange={onSearchTermChange}
          >
            <AxoSearchField.Icon />
            <AxoSearchField.Input autoFocus placeholder={i18n('icu:search')} />
            <AxoSearchField.Clear />
          </AxoSearchField.Root>
        </AxoDialog.Search>
        <AxoDialog.Body padding="md" forceMaxHeight>
          {filteredCountries.length !== 0 && (
            <AxoList.Group>
              <AxoList.Root>
                <AxoList.Body>
                  <AxoItem.Group>
                    {filteredCountries.map(country => {
                      return (
                        <AxoClickableItem.Root
                          key={country.region}
                          label={country.displayName}
                          value={country.code}
                          onClick={() => {
                            onCountryClick(country.region);
                          }}
                        />
                      );
                    })}
                  </AxoItem.Group>
                </AxoList.Body>
              </AxoList.Root>
            </AxoList.Group>
          )}
        </AxoDialog.Body>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}
