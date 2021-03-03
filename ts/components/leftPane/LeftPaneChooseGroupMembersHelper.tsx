// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { ReactChild, ChangeEvent } from 'react';

import { LeftPaneHelper } from './LeftPaneHelper';
import { Row, RowType } from '../ConversationList';
import { ConversationType } from '../../state/ducks/conversations';
import { ContactCheckboxDisabledReason } from '../conversationList/ContactCheckbox';
import { ContactPills } from '../ContactPills';
import { ContactPill } from '../ContactPill';
import { Alert } from '../Alert';
import { Button } from '../Button';
import { LocalizerType } from '../../types/Util';
import {
  getGroupSizeRecommendedLimit,
  getGroupSizeHardLimit,
} from '../../groups/limits';

export type LeftPaneChooseGroupMembersPropsType = {
  candidateContacts: ReadonlyArray<ConversationType>;
  cantAddContactForModal: undefined | ConversationType;
  isShowingRecommendedGroupSizeModal: boolean;
  isShowingMaximumGroupSizeModal: boolean;
  searchTerm: string;
  selectedContacts: Array<ConversationType>;
};

/* eslint-disable class-methods-use-this */

export class LeftPaneChooseGroupMembersHelper extends LeftPaneHelper<
  LeftPaneChooseGroupMembersPropsType
> {
  private readonly candidateContacts: ReadonlyArray<ConversationType>;

  private readonly cantAddContactForModal:
    | undefined
    | Readonly<{ title: string }>;

  private readonly isShowingMaximumGroupSizeModal: boolean;

  private readonly isShowingRecommendedGroupSizeModal: boolean;

  private readonly searchTerm: string;

  private readonly selectedContacts: Array<ConversationType>;

  private readonly selectedConversationIdsSet: Set<string>;

  constructor({
    candidateContacts,
    cantAddContactForModal,
    isShowingMaximumGroupSizeModal,
    isShowingRecommendedGroupSizeModal,
    searchTerm,
    selectedContacts,
  }: Readonly<LeftPaneChooseGroupMembersPropsType>) {
    super();

    this.candidateContacts = candidateContacts;
    this.cantAddContactForModal = cantAddContactForModal;
    this.isShowingMaximumGroupSizeModal = isShowingMaximumGroupSizeModal;
    this.isShowingRecommendedGroupSizeModal = isShowingRecommendedGroupSizeModal;
    this.searchTerm = searchTerm;
    this.selectedContacts = selectedContacts;

    this.selectedConversationIdsSet = new Set(
      selectedContacts.map(contact => contact.id)
    );
  }

  getHeaderContents({
    i18n,
    startComposing,
  }: Readonly<{
    i18n: LocalizerType;
    startComposing: () => void;
  }>): ReactChild {
    const backButtonLabel = i18n('chooseGroupMembers__back-button');

    return (
      <div className="module-left-pane__header__contents">
        <button
          aria-label={backButtonLabel}
          className="module-left-pane__header__contents__back-button"
          onClick={startComposing}
          title={backButtonLabel}
          type="button"
        />
        <div className="module-left-pane__header__contents__text">
          {i18n('chooseGroupMembers__title')}
        </div>
      </div>
    );
  }

  getPreRowsNode({
    closeCantAddContactToGroupModal,
    closeMaximumGroupSizeModal,
    closeRecommendedGroupSizeModal,
    i18n,
    onChangeComposeSearchTerm,
    removeSelectedContact,
  }: Readonly<{
    closeCantAddContactToGroupModal: () => unknown;
    closeMaximumGroupSizeModal: () => unknown;
    closeRecommendedGroupSizeModal: () => unknown;
    i18n: LocalizerType;
    onChangeComposeSearchTerm: (
      event: ChangeEvent<HTMLInputElement>
    ) => unknown;
    removeSelectedContact: (conversationId: string) => unknown;
  }>): ReactChild {
    let modalDetails:
      | undefined
      | { title: string; body: string; onClose: () => void };
    if (this.isShowingMaximumGroupSizeModal) {
      modalDetails = {
        title: i18n('chooseGroupMembers__maximum-group-size__title'),
        body: i18n('chooseGroupMembers__maximum-group-size__body', [
          this.getMaximumNumberOfContacts().toString(),
        ]),
        onClose: closeMaximumGroupSizeModal,
      };
    } else if (this.isShowingRecommendedGroupSizeModal) {
      modalDetails = {
        title: i18n(
          'chooseGroupMembers__maximum-recommended-group-size__title'
        ),
        body: i18n('chooseGroupMembers__maximum-recommended-group-size__body', [
          this.getRecommendedMaximumNumberOfContacts().toString(),
        ]),
        onClose: closeRecommendedGroupSizeModal,
      };
    } else if (this.cantAddContactForModal) {
      modalDetails = {
        title: i18n('chooseGroupMembers__cant-add-member__title'),
        body: i18n('chooseGroupMembers__cant-add-member__body', [
          this.cantAddContactForModal.title,
        ]),
        onClose: closeCantAddContactToGroupModal,
      };
    }

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

        {Boolean(this.selectedContacts.length) && (
          <ContactPills>
            {this.selectedContacts.map(contact => (
              <ContactPill
                key={contact.id}
                avatarPath={contact.avatarPath}
                color={contact.color}
                firstName={contact.firstName}
                i18n={i18n}
                id={contact.id}
                name={contact.name}
                phoneNumber={contact.phoneNumber}
                profileName={contact.profileName}
                title={contact.title}
                onClickRemove={removeSelectedContact}
              />
            ))}
          </ContactPills>
        )}

        {this.getRowCount() ? null : (
          <div className="module-left-pane__compose-no-contacts">
            {i18n('newConversationNoContacts')}
          </div>
        )}

        {modalDetails && (
          <Alert
            body={modalDetails.body}
            i18n={i18n}
            onClose={modalDetails.onClose}
            title={modalDetails.title}
          />
        )}
      </>
    );
  }

  getFooterContents({
    i18n,
    startSettingGroupMetadata,
  }: Readonly<{
    i18n: LocalizerType;
    startSettingGroupMetadata: () => void;
  }>): ReactChild {
    return (
      <Button
        disabled={this.hasExceededMaximumNumberOfContacts()}
        onClick={startSettingGroupMetadata}
      >
        {this.selectedContacts.length
          ? i18n('chooseGroupMembers__next')
          : i18n('chooseGroupMembers__skip')}
      </Button>
    );
  }

  getRowCount(): number {
    if (!this.candidateContacts.length) {
      return 0;
    }
    return this.candidateContacts.length + 2;
  }

  getRow(rowIndex: number): undefined | Row {
    if (!this.candidateContacts.length) {
      return undefined;
    }

    if (rowIndex === 0) {
      return {
        type: RowType.Header,
        i18nKey: 'contactsHeader',
      };
    }

    // This puts a blank row for the footer.
    if (rowIndex === this.candidateContacts.length + 1) {
      return { type: RowType.Blank };
    }

    const contact = this.candidateContacts[rowIndex - 1];
    if (!contact) {
      return undefined;
    }

    const isChecked = this.selectedConversationIdsSet.has(contact.id);

    let disabledReason: undefined | ContactCheckboxDisabledReason;
    if (!isChecked) {
      if (this.hasSelectedMaximumNumberOfContacts()) {
        disabledReason = ContactCheckboxDisabledReason.MaximumContactsSelected;
      } else if (!contact.isGroupV2Capable) {
        disabledReason = ContactCheckboxDisabledReason.NotCapable;
      }
    }

    return {
      type: RowType.ContactCheckbox,
      contact,
      isChecked,
      disabledReason,
    };
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

  private hasSelectedMaximumNumberOfContacts(): boolean {
    return this.selectedContacts.length >= this.getMaximumNumberOfContacts();
  }

  private hasExceededMaximumNumberOfContacts(): boolean {
    // It should be impossible to reach this state. This is here as a failsafe.
    return this.selectedContacts.length > this.getMaximumNumberOfContacts();
  }

  private getRecommendedMaximumNumberOfContacts(): number {
    return getGroupSizeRecommendedLimit(151) - 1;
  }

  private getMaximumNumberOfContacts(): number {
    return getGroupSizeHardLimit(1001) - 1;
  }
}

function focusRef(el: HTMLElement | null) {
  if (el) {
    el.focus();
  }
}
