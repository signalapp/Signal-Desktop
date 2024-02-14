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
import type { LookupConversationWithoutServiceIdActionsType } from '../../util/lookupConversationWithoutServiceId';
import { Spinner } from '../Spinner';
import { Button } from '../Button';

export type LeftPaneFindByUsernamePropsType = {
  searchTerm: string;
  uuidFetchState: UUIDFetchStateType;
  username: string | undefined;
};

export class LeftPaneFindByUsernameHelper extends LeftPaneHelper<LeftPaneFindByUsernamePropsType> {
  private readonly searchTerm: string;

  private readonly username: string | undefined;

  private readonly uuidFetchState: UUIDFetchStateType;

  constructor({
    searchTerm,
    uuidFetchState,
    username,
  }: Readonly<LeftPaneFindByUsernamePropsType>) {
    super();

    this.searchTerm = searchTerm;
    this.uuidFetchState = uuidFetchState;

    this.username = username;
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
          disabled={this.isFetching()}
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
    return this.isFetching() ? undefined : startComposing;
  }

  override getSearchInput({
    i18n,
    onChangeComposeSearchTerm,
  }: Readonly<{
    i18n: LocalizerType;
    onChangeComposeSearchTerm: (
      event: React.ChangeEvent<HTMLInputElement>
    ) => unknown;
  }>): ReactChild {
    const placeholder = i18n(
      'icu:LeftPaneFindByHelper__placeholder--findByUsername'
    );
    const description = i18n(
      'icu:LeftPaneFindByHelper__description--findByUsername'
    );
    return (
      <SearchInput
        hasSearchIcon={false}
        disabled={this.isFetching()}
        i18n={i18n}
        moduleClassName="LeftPaneFindByUsernameHelper__search-input"
        onChange={onChangeComposeSearchTerm}
        placeholder={placeholder}
        ref={focusRef}
        value={this.searchTerm}
        description={description}
      />
    );
  }

  override getFooterContents({
    i18n,
    lookupConversationWithoutServiceId,
    showUserNotFoundModal,
    setIsFetchingUUID,
    showInbox,
    showConversation,
  }: Readonly<{
    i18n: LocalizerType;
    showInbox: () => void;
    showConversation: ShowConversationType;
  }> &
    LookupConversationWithoutServiceIdActionsType): ReactChild {
    return (
      <Button
        disabled={this.isLookupDisabled()}
        onClick={async () => {
          if (!this.username) {
            return;
          }

          const conversationId = await lookupConversationWithoutServiceId({
            showUserNotFoundModal,
            setIsFetchingUUID,
            type: 'username',
            username: this.username,
          });

          if (conversationId != null) {
            showConversation({ conversationId });
            showInbox();
          }
        }}
      >
        {this.isFetching() ? (
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

  private isFetching(): boolean {
    if (this.username != null) {
      return isFetchingByUsername(this.uuidFetchState, this.username);
    }

    return false;
  }

  private isLookupDisabled(): boolean {
    if (this.isFetching()) {
      return true;
    }

    return this.username == null;
  }
}

function focusRef(el: HTMLElement | null) {
  if (el) {
    el.focus();
  }
}
