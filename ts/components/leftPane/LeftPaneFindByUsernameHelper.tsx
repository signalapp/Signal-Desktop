// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactChild } from 'react';
import React from 'react';

import { LeftPaneHelper } from './LeftPaneHelper';
import type { Row } from '../ConversationList';
import { RowType } from '../ConversationList';
import { SearchInput } from '../SearchInput';
import type { LocalizerType } from '../../types/Util';
import type { ShowConversationType } from '../../state/ducks/conversations';
import type { UUIDFetchStateType } from '../../util/uuidFetchState';
import { isFetchingByUsername } from '../../util/uuidFetchState';
import { drop } from '../../util/drop';
import type { LookupConversationWithoutServiceIdActionsType } from '../../util/lookupConversationWithoutServiceId';
import { Spinner } from '../Spinner';
import { Button } from '../Button';

export type LeftPaneFindByUsernamePropsType = {
  searchTerm: string;
  uuidFetchState: UUIDFetchStateType;
  username: string | undefined;
};

type DoLookupActionsType = Readonly<{
  showInbox: () => void;
  showConversation: ShowConversationType;
}> &
  LookupConversationWithoutServiceIdActionsType;

export class LeftPaneFindByUsernameHelper extends LeftPaneHelper<LeftPaneFindByUsernamePropsType> {
  readonly #searchTerm: string;
  readonly #username: string | undefined;
  readonly #uuidFetchState: UUIDFetchStateType;

  constructor({
    searchTerm,
    uuidFetchState,
    username,
  }: Readonly<LeftPaneFindByUsernamePropsType>) {
    super();

    this.#searchTerm = searchTerm;
    this.#uuidFetchState = uuidFetchState;

    this.#username = username;
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
          {i18n('icu:LeftPaneFindByHelper__title--findByUsername')}
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
    ...lookupActions
  }: Readonly<{
    i18n: LocalizerType;
    onChangeComposeSearchTerm: (
      event: React.ChangeEvent<HTMLInputElement>
    ) => unknown;
  }> &
    DoLookupActionsType): ReactChild {
    const placeholder = i18n(
      'icu:LeftPaneFindByHelper__placeholder--findByUsername'
    );
    const description = i18n(
      'icu:LeftPaneFindByHelper__description--findByUsername'
    );
    return (
      <SearchInput
        hasSearchIcon={false}
        disabled={this.#isFetching()}
        i18n={i18n}
        moduleClassName="LeftPaneFindByUsernameHelper__search-input"
        onChange={onChangeComposeSearchTerm}
        placeholder={placeholder}
        ref={focusRef}
        value={this.#searchTerm}
        description={description}
        onKeyDown={ev => {
          if (ev.key === 'Enter') {
            drop(this.#doLookup(lookupActions));
          }
        }}
      />
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
    if (!this.#username || this.#isLookupDisabled()) {
      return;
    }

    const conversationId = await lookupConversationWithoutServiceId({
      showUserNotFoundModal,
      setIsFetchingUUID,
      type: 'username',
      username: this.#username,
    });

    if (conversationId != null) {
      showConversation({ conversationId });
      showInbox();
    }
  }

  #isFetching(): boolean {
    if (this.#username != null) {
      return isFetchingByUsername(this.#uuidFetchState, this.#username);
    }

    return false;
  }

  #isLookupDisabled(): boolean {
    if (this.#isFetching()) {
      return true;
    }

    return this.#username == null;
  }
}

function focusRef(el: HTMLElement | null) {
  if (el) {
    el.focus();
  }
}
