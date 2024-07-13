// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState, useCallback, useMemo } from 'react';
import Fuse from 'fuse.js';

import type { LocalizerType } from '../types/Util';
import type { CountryDataType } from '../util/getCountryData';
import { Modal } from './Modal';
import { SearchInput } from './SearchInput';

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

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const selectedCountry = useMemo(() => {
    return countries.find(({ region }) => region === value);
  }, [countries, value]);

  const defaultCode = useMemo(() => {
    return countries.find(({ region }) => region === defaultRegion)?.code ?? '';
  }, [countries, defaultRegion]);

  const filteredCountries = useMemo(() => {
    if (!searchTerm) {
      return countries;
    }
    return index.search(searchTerm).map(({ item }) => item);
  }, [countries, index, searchTerm]);

  const onShowModal = useCallback((ev: React.MouseEvent) => {
    ev.preventDefault();
    setIsModalOpen(true);
  }, []);

  const onCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setSearchTerm('');
  }, []);

  const onSearchTermChange = useCallback(
    (ev: React.ChangeEvent<HTMLInputElement>) => {
      setSearchTerm(ev.target.value);
    },
    []
  );

  const onCountryClick = useCallback(
    (region: string) => {
      onCloseModal();
      onChange(region);
    },
    [onChange, onCloseModal]
  );

  const modal = (
    <Modal
      i18n={i18n}
      modalName="CountryCodeSelect__Modal"
      moduleClassName="CountryCodeSelect__Modal"
      hasXButton
      padded={false}
      title={i18n('icu:CountryCodeSelect__Modal__title')}
      onClose={onCloseModal}
    >
      <SearchInput
        i18n={i18n}
        moduleClassName="CountryCodeSelect__Modal__Search"
        onChange={onSearchTermChange}
        placeholder={i18n('icu:search')}
        value={searchTerm}
      />
      <div className="CountryCodeSelect__table">
        {filteredCountries.map(({ displayName, region, code }) => {
          return (
            <CountryButton
              key={region}
              region={region}
              displayName={displayName}
              code={code}
              onClick={onCountryClick}
            />
          );
        })}
      </div>
      <div className="CountryCodeSelect__grow" />
    </Modal>
  );

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
      {isModalOpen ? modal : null}
    </>
  );
}

type CountryButtonPropsType = Readonly<{
  region: string;
  displayName: string;
  code: string;
  onClick: (region: string) => void;
}>;

function CountryButton({
  region,
  displayName,
  code,
  onClick,
}: CountryButtonPropsType): JSX.Element {
  const onButtonClick = useCallback(
    (ev: React.MouseEvent) => {
      ev.preventDefault();
      onClick(region);
    },
    [region, onClick]
  );

  return (
    <button
      type="button"
      className="CountryCodeSelect__CountryButton"
      onClick={onButtonClick}
    >
      <div className="CountryCodeSelect__CountryButton__name">
        {displayName}
      </div>
      <div className="CountryCodeSelect__CountryButton__code">{code}</div>
    </button>
  );
}
