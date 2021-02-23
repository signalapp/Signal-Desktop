// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { ReactChild, ChangeEvent } from 'react';
import { PhoneNumber } from 'google-libphonenumber';

import { LeftPaneHelper } from './LeftPaneHelper';
import { Row, RowType } from '../ConversationList';
import { PropsDataType as ContactListItemPropsType } from '../conversationList/ContactListItem';
import { LocalizerType } from '../../types/Util';
import {
  instance as phoneNumberInstance,
  PhoneNumberFormat,
} from '../../util/libphonenumberInstance';

export type LeftPaneComposePropsType = {
  composeContacts: ReadonlyArray<ContactListItemPropsType>;
  regionCode: string;
  searchTerm: string;
};

/* eslint-disable class-methods-use-this */

export class LeftPaneComposeHelper extends LeftPaneHelper<
  LeftPaneComposePropsType
> {
  private readonly composeContacts: ReadonlyArray<ContactListItemPropsType>;

  private readonly searchTerm: string;

  private readonly phoneNumber: undefined | PhoneNumber;

  constructor({
    composeContacts,
    regionCode,
    searchTerm,
  }: Readonly<LeftPaneComposePropsType>) {
    super();

    this.composeContacts = composeContacts;
    this.searchTerm = searchTerm;
    this.phoneNumber = parsePhoneNumber(searchTerm, regionCode);
  }

  getHeaderContents({
    i18n,
    showInbox,
  }: Readonly<{
    i18n: LocalizerType;
    showInbox: () => void;
  }>): ReactChild {
    return (
      <div className="module-left-pane__header__contents">
        <button
          onClick={showInbox}
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

  getPreRowsNode({
    i18n,
    onChangeComposeSearchTerm,
  }: Readonly<{
    i18n: LocalizerType;
    onChangeComposeSearchTerm: (
      event: ChangeEvent<HTMLInputElement>
    ) => unknown;
  }>): ReactChild {
    return (
      <>
        <div className="module-left-pane__compose-search-form">
          <input
            type="text"
            ref={focusRef}
            className="module-left-pane__compose-search-form__input"
            placeholder={i18n('newConversationContactSearchPlaceholder')}
            dir="auto"
            value={this.searchTerm}
            onChange={onChangeComposeSearchTerm}
          />
        </div>

        {this.getRowCount() ? null : (
          <div className="module-left-pane__compose-no-contacts">
            {i18n('newConversationNoContacts')}
          </div>
        )}
      </>
    );
  }

  getRowCount(): number {
    return this.composeContacts.length + (this.phoneNumber ? 1 : 0);
  }

  getRow(rowIndex: number): undefined | Row {
    let contactIndex = rowIndex;

    if (this.phoneNumber) {
      if (rowIndex === 0) {
        return {
          type: RowType.StartNewConversation,
          phoneNumber: phoneNumberInstance.format(
            this.phoneNumber,
            PhoneNumberFormat.E164
          ),
        };
      }

      contactIndex -= 1;
    }

    const contact = this.composeContacts[contactIndex];
    return contact
      ? {
          type: RowType.Contact,
          contact,
        }
      : undefined;
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
}

function focusRef(el: HTMLElement | null) {
  if (el) {
    el.focus();
  }
}

function parsePhoneNumber(
  str: string,
  regionCode: string
): undefined | PhoneNumber {
  let result: PhoneNumber;
  try {
    result = phoneNumberInstance.parse(str, regionCode);
  } catch (err) {
    return undefined;
  }

  if (!phoneNumberInstance.isValidNumber(result)) {
    return undefined;
  }

  return result;
}
