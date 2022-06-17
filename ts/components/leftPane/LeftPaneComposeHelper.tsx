// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactChild, ChangeEvent } from 'react';
import React from 'react';

import { LeftPaneHelper } from './LeftPaneHelper';
import type { Row } from '../ConversationList';
import { RowType } from '../ConversationList';
import type { ContactListItemConversationType } from '../conversationList/ContactListItem';
import type { PropsData as ConversationListItemPropsType } from '../conversationList/ConversationListItem';
import { SearchInput } from '../SearchInput';
import type { LocalizerType } from '../../types/Util';
import type { ParsedE164Type } from '../../util/libphonenumberInstance';
import { parseAndFormatPhoneNumber } from '../../util/libphonenumberInstance';
import { missingCaseError } from '../../util/missingCaseError';
import { getUsernameFromSearch } from '../../types/Username';
import type { UUIDFetchStateType } from '../../util/uuidFetchState';
import {
  isFetchingByUsername,
  isFetchingByE164,
} from '../../util/uuidFetchState';

export type LeftPaneComposePropsType = {
  composeContacts: ReadonlyArray<ContactListItemConversationType>;
  composeGroups: ReadonlyArray<ConversationListItemPropsType>;

  regionCode: string | undefined;
  searchTerm: string;
  uuidFetchState: UUIDFetchStateType;
  isUsernamesEnabled: boolean;
};

enum TopButton {
  None,
  CreateNewGroup,
}

export class LeftPaneComposeHelper extends LeftPaneHelper<LeftPaneComposePropsType> {
  private readonly composeContacts: ReadonlyArray<ContactListItemConversationType>;

  private readonly composeGroups: ReadonlyArray<ConversationListItemPropsType>;

  private readonly uuidFetchState: UUIDFetchStateType;

  private readonly searchTerm: string;

  private readonly phoneNumber: ParsedE164Type | undefined;

  private readonly isPhoneNumberVisible: boolean;

  private readonly username: string | undefined;

  private readonly isUsernameVisible: boolean;

  constructor({
    composeContacts,
    composeGroups,
    regionCode,
    searchTerm,
    isUsernamesEnabled,
    uuidFetchState,
  }: Readonly<LeftPaneComposePropsType>) {
    super();

    this.composeContacts = composeContacts;
    this.composeGroups = composeGroups;
    this.searchTerm = searchTerm;
    this.phoneNumber = parseAndFormatPhoneNumber(searchTerm, regionCode);
    if (this.phoneNumber) {
      const { phoneNumber } = this;
      this.isPhoneNumberVisible = this.composeContacts.every(
        contact => contact.e164 !== phoneNumber.e164
      );
    } else {
      this.isPhoneNumberVisible = false;
    }
    this.uuidFetchState = uuidFetchState;

    if (isUsernamesEnabled && !this.phoneNumber) {
      this.username = getUsernameFromSearch(this.searchTerm);
      this.isUsernameVisible =
        isUsernamesEnabled &&
        Boolean(this.username) &&
        this.composeContacts.every(
          contact => contact.username !== this.username
        );
    } else {
      this.isUsernameVisible = false;
    }
  }

  override getHeaderContents({
    i18n,
    showInbox,
  }: Readonly<{
    i18n: LocalizerType;
    showInbox: () => void;
  }>): ReactChild {
    return (
      <div className="module-left-pane__header__contents">
        <button
          onClick={this.getBackAction({ showInbox })}
          className="module-left-pane__header__contents__back-button"
          title={i18n('backToInbox')}
          aria-label={i18n('backToInbox')}
          type="button"
        />
        <div className="module-left-pane__header__contents__text">
          {i18n('newConversation')}
        </div>
      </div>
    );
  }

  override getBackAction({ showInbox }: { showInbox: () => void }): () => void {
    return showInbox;
  }

  override getSearchInput({
    i18n,
    onChangeComposeSearchTerm,
  }: Readonly<{
    i18n: LocalizerType;
    onChangeComposeSearchTerm: (
      event: ChangeEvent<HTMLInputElement>
    ) => unknown;
  }>): ReactChild {
    return (
      <SearchInput
        i18n={i18n}
        moduleClassName="module-left-pane__compose-search-form"
        onChange={onChangeComposeSearchTerm}
        placeholder={i18n('contactSearchPlaceholder')}
        ref={focusRef}
        value={this.searchTerm}
      />
    );
  }

  override getPreRowsNode({
    i18n,
  }: Readonly<{
    i18n: LocalizerType;
  }>): ReactChild | null {
    return this.getRowCount() ? null : (
      <div className="module-left-pane__compose-no-contacts">
        {i18n('noConversationsFound')}
      </div>
    );
  }

  getRowCount(): number {
    let result = this.composeContacts.length + this.composeGroups.length;
    if (this.hasTopButton()) {
      result += 1;
    }
    if (this.hasContactsHeader()) {
      result += 1;
    }
    if (this.hasGroupsHeader()) {
      result += 1;
    }
    if (this.isUsernameVisible) {
      result += 2;
    }
    if (this.isPhoneNumberVisible) {
      result += 2;
    }

    return result;
  }

  getRow(actualRowIndex: number): undefined | Row {
    let virtualRowIndex = actualRowIndex;
    if (this.hasTopButton()) {
      if (virtualRowIndex === 0) {
        const topButton = this.getTopButton();
        switch (topButton) {
          case TopButton.None:
            break;
          case TopButton.CreateNewGroup:
            return { type: RowType.CreateNewGroup };
          default:
            throw missingCaseError(topButton);
        }
      }

      virtualRowIndex -= 1;
    }

    if (this.hasContactsHeader()) {
      if (virtualRowIndex === 0) {
        return {
          type: RowType.Header,
          i18nKey: 'contactsHeader',
        };
      }

      virtualRowIndex -= 1;

      const contact = this.composeContacts[virtualRowIndex];
      if (contact) {
        return {
          type: RowType.Contact,
          contact,
        };
      }

      virtualRowIndex -= this.composeContacts.length;
    }

    if (this.hasGroupsHeader()) {
      if (virtualRowIndex === 0) {
        return {
          type: RowType.Header,
          i18nKey: 'groupsHeader',
        };
      }

      virtualRowIndex -= 1;

      const group = this.composeGroups[virtualRowIndex];
      if (group) {
        return {
          type: RowType.Conversation,
          conversation: group,
        };
      }

      virtualRowIndex -= this.composeGroups.length;
    }

    if (this.username && this.isUsernameVisible) {
      if (virtualRowIndex === 0) {
        return {
          type: RowType.Header,
          i18nKey: 'findByUsernameHeader',
        };
      }

      virtualRowIndex -= 1;

      if (virtualRowIndex === 0) {
        return {
          type: RowType.UsernameSearchResult,
          username: this.username,
          isFetchingUsername: isFetchingByUsername(
            this.uuidFetchState,
            this.username
          ),
        };

        virtualRowIndex -= 1;
      }
    }

    if (this.phoneNumber && this.isPhoneNumberVisible) {
      if (virtualRowIndex === 0) {
        return {
          type: RowType.Header,
          i18nKey: 'findByPhoneNumberHeader',
        };
      }

      virtualRowIndex -= 1;

      if (virtualRowIndex === 0) {
        return {
          type: RowType.StartNewConversation,
          phoneNumber: this.phoneNumber,
          isFetching: isFetchingByE164(
            this.uuidFetchState,
            this.phoneNumber.e164
          ),
        };

        virtualRowIndex -= 1;
      }
    }

    return undefined;
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

  shouldRecomputeRowHeights(
    exProps: Readonly<LeftPaneComposePropsType>
  ): boolean {
    const prev = new LeftPaneComposeHelper(exProps);
    const currHeaderIndices = this.getHeaderIndices();
    const prevHeaderIndices = prev.getHeaderIndices();

    return (
      currHeaderIndices.top !== prevHeaderIndices.top ||
      currHeaderIndices.contact !== prevHeaderIndices.contact ||
      currHeaderIndices.group !== prevHeaderIndices.group ||
      currHeaderIndices.username !== prevHeaderIndices.username ||
      currHeaderIndices.phoneNumber !== prevHeaderIndices.phoneNumber
    );
  }

  private getTopButton(): TopButton {
    if (this.searchTerm) {
      return TopButton.None;
    }
    return TopButton.CreateNewGroup;
  }

  private hasTopButton(): boolean {
    return this.getTopButton() !== TopButton.None;
  }

  private hasContactsHeader(): boolean {
    return Boolean(this.composeContacts.length);
  }

  private hasGroupsHeader(): boolean {
    return Boolean(this.composeGroups.length);
  }

  private getHeaderIndices(): {
    top?: number;
    contact?: number;
    group?: number;
    phoneNumber?: number;
    username?: number;
  } {
    let top: number | undefined;
    let contact: number | undefined;
    let group: number | undefined;
    let phoneNumber: number | undefined;
    let username: number | undefined;

    let rowCount = 0;

    if (this.hasTopButton()) {
      top = 0;
      rowCount += 1;
    }
    if (this.hasContactsHeader()) {
      contact = rowCount;
      rowCount += this.composeContacts.length;
    }
    if (this.hasGroupsHeader()) {
      group = rowCount;
      rowCount += this.composeContacts.length;
    }
    if (this.phoneNumber) {
      phoneNumber = rowCount;
    }
    if (this.username) {
      username = rowCount;
    }

    return {
      top,
      contact,
      group,
      phoneNumber,
      username,
    };
  }
}

function focusRef(el: HTMLElement | null) {
  if (el) {
    el.focus();
  }
}
