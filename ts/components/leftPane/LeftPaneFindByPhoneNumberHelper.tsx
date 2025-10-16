// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactChild } from 'react';
import React from 'react';

import { LeftPaneHelper } from './LeftPaneHelper.dom.js';
import type { Row } from '../ConversationList.dom.js';
import { RowType } from '../ConversationList.dom.js';
import { SearchInput } from '../SearchInput.dom.js';
import type { LocalizerType } from '../../types/Util.std.js';
import type { ShowConversationType } from '../../state/ducks/conversations.preload.js';
import type { ParsedE164Type } from '../../util/libphonenumberInstance.std.js';
import { parseAndFormatPhoneNumber } from '../../util/libphonenumberInstance.std.js';
import type { UUIDFetchStateType } from '../../util/uuidFetchState.std.js';
import type { CountryDataType } from '../../util/getCountryData.dom.js';
import { isFetchingByE164 } from '../../util/uuidFetchState.std.js';
import { drop } from '../../util/drop.std.js';
import type { LookupConversationWithoutServiceIdActionsType } from '../../util/lookupConversationWithoutServiceId.preload.js';
import { Spinner } from '../Spinner.dom.js';
import { Button } from '../Button.dom.js';
import { CountryCodeSelect } from '../CountryCodeSelect.dom.js';

export type LeftPaneFindByPhoneNumberPropsType = {
  searchTerm: string;
  regionCode: string | undefined;
  uuidFetchState: UUIDFetchStateType;
  selectedRegion: string;
  countries: ReadonlyArray<CountryDataType>;
};

type DoLookupActionsType = Readonly<{
  showInbox: () => void;
  showConversation: ShowConversationType;
}> &
  LookupConversationWithoutServiceIdActionsType;

export class LeftPaneFindByPhoneNumberHelper extends LeftPaneHelper<LeftPaneFindByPhoneNumberPropsType> {
  readonly #searchTerm: string;
  readonly #phoneNumber: ParsedE164Type | undefined;
  readonly #regionCode: string | undefined;
  readonly #uuidFetchState: UUIDFetchStateType;
  readonly #countries: ReadonlyArray<CountryDataType>;
  readonly #selectedRegion: string;

  constructor({
    searchTerm,
    regionCode,
    uuidFetchState,
    countries,
    selectedRegion,
  }: Readonly<LeftPaneFindByPhoneNumberPropsType>) {
    super();

    this.#searchTerm = searchTerm;
    this.#uuidFetchState = uuidFetchState;
    this.#regionCode = regionCode;
    this.#countries = countries;
    this.#selectedRegion = selectedRegion;

    this.#phoneNumber = parseAndFormatPhoneNumber(
      this.#searchTerm,
      selectedRegion || regionCode
    );
  }

  override getHeaderContents({
    i18n,
    startComposing,
  }: Readonly<{
    i18n: LocalizerType;
    startComposing: () => void;
  }>): ReactChild {
    const backButtonLabel = i18n('icu:setGroupMetadata__back-button');

    return (
      <div className="module-left-pane__header__contents">
        <button
          aria-label={backButtonLabel}
          className="module-left-pane__header__contents__back-button"
          disabled={this.#isFetching()}
          onClick={this.getBackAction({ startComposing })}
          title={backButtonLabel}
          type="button"
        />
        <div className="module-left-pane__header__contents__text">
          {i18n('icu:LeftPaneFindByHelper__title--findByPhoneNumber')}
        </div>
      </div>
    );
  }

  override getBackAction({
    startComposing,
  }: {
    startComposing: () => void;
  }): undefined | (() => void) {
    return this.#isFetching() ? undefined : startComposing;
  }

  override getSearchInput({
    i18n,
    onChangeComposeSearchTerm,
    onChangeComposeSelectedRegion,
    ...lookupActions
  }: Readonly<{
    i18n: LocalizerType;
    onChangeComposeSearchTerm: (
      event: React.ChangeEvent<HTMLInputElement>
    ) => unknown;
    onChangeComposeSelectedRegion: (newRegion: string) => void;
  }> &
    DoLookupActionsType): ReactChild {
    const placeholder = i18n(
      'icu:LeftPaneFindByHelper__placeholder--findByPhoneNumber'
    );
    return (
      <div className="LeftPaneFindByPhoneNumberHelper__container">
        <CountryCodeSelect
          countries={this.#countries}
          i18n={i18n}
          defaultRegion={this.#regionCode ?? ''}
          value={this.#selectedRegion}
          onChange={onChangeComposeSelectedRegion}
        />

        <SearchInput
          hasSearchIcon={false}
          disabled={this.#isFetching()}
          i18n={i18n}
          moduleClassName="LeftPaneFindByPhoneNumberHelper__search-input"
          onChange={onChangeComposeSearchTerm}
          placeholder={placeholder}
          ref={focusRef}
          value={this.#searchTerm}
          onKeyDown={ev => {
            if (ev.key === 'Enter') {
              drop(this.#doLookup(lookupActions));
            }
          }}
        />
      </div>
    );
  }

  override getFooterContents({
    i18n,
    ...lookupActions
  }: Readonly<{
    i18n: LocalizerType;
  }> &
    DoLookupActionsType): ReactChild {
    return (
      <Button
        disabled={this.#isLookupDisabled()}
        onClick={() => drop(this.#doLookup(lookupActions))}
      >
        {this.#isFetching() ? (
          <span aria-label={i18n('icu:loading')} role="status">
            <Spinner size="20px" svgSize="small" direction="on-avatar" />
          </span>
        ) : (
          i18n('icu:next2')
        )}
      </Button>
    );
  }

  getRowCount(): number {
    return 1;
  }

  getRow(): Row {
    // This puts a blank row for the footer.
    return { type: RowType.Blank };
  }

  // This is deliberately unimplemented because these keyboard shortcuts shouldn't work in
  //   the composer. The same is true for the "in direction" function below.
  getConversationAndMessageAtIndex(
    ..._args: ReadonlyArray<unknown>
  ): undefined {
    return undefined;
  }

  getConversationAndMessageInDirection(
    ..._args: ReadonlyArray<unknown>
  ): undefined {
    return undefined;
  }

  shouldRecomputeRowHeights(_old: unknown): boolean {
    return false;
  }

  async #doLookup({
    lookupConversationWithoutServiceId,
    showUserNotFoundModal,
    setIsFetchingUUID,
    showInbox,
    showConversation,
  }: DoLookupActionsType): Promise<void> {
    if (!this.#phoneNumber || this.#isLookupDisabled()) {
      return;
    }

    const conversationId = await lookupConversationWithoutServiceId({
      showUserNotFoundModal,
      setIsFetchingUUID,
      type: 'e164',
      e164: this.#phoneNumber.e164,
      phoneNumber: this.#searchTerm,
    });

    if (conversationId != null) {
      showConversation({ conversationId });
      showInbox();
    }
  }

  #isFetching(): boolean {
    if (this.#phoneNumber != null) {
      return isFetchingByE164(this.#uuidFetchState, this.#phoneNumber.e164);
    }

    return false;
  }

  #isLookupDisabled(): boolean {
    if (this.#isFetching()) {
      return true;
    }

    return !this.#phoneNumber?.isValid;
  }
}

function focusRef(el: HTMLElement | null) {
  if (el) {
    el.focus();
  }
}
