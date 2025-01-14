// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactChild } from 'react';
import React from 'react';

import { LeftPaneHelper } from './LeftPaneHelper';
import type { Row } from '../ConversationList';
import { RowType } from '../ConversationList';
import type { ContactListItemConversationType } from '../conversationList/ContactListItem';
import { DisappearingTimerSelect } from '../DisappearingTimerSelect';
import type { LocalizerType } from '../../types/Util';
import type { DurationInSeconds } from '../../util/durations';
import { Alert } from '../Alert';
import { AvatarEditor } from '../AvatarEditor';
import { AvatarPreview } from '../AvatarPreview';
import { Spinner } from '../Spinner';
import { Button } from '../Button';
import { Modal } from '../Modal';
import { GroupTitleInput } from '../GroupTitleInput';
import type {
  AvatarDataType,
  DeleteAvatarFromDiskActionType,
  ReplaceAvatarActionType,
  SaveAvatarToDiskActionType,
} from '../../types/Avatar';
import { AvatarColors } from '../../types/Colors';

export type LeftPaneSetGroupMetadataPropsType = {
  groupAvatar: undefined | Uint8Array;
  groupName: string;
  groupExpireTimer: DurationInSeconds;
  hasError: boolean;
  isCreating: boolean;
  isEditingAvatar: boolean;
  selectedContacts: ReadonlyArray<ContactListItemConversationType>;
  userAvatarData: ReadonlyArray<AvatarDataType>;
};

export class LeftPaneSetGroupMetadataHelper extends LeftPaneHelper<LeftPaneSetGroupMetadataPropsType> {
  readonly #groupAvatar: undefined | Uint8Array;
  readonly #groupName: string;
  readonly #groupExpireTimer: DurationInSeconds;
  readonly #hasError: boolean;
  readonly #isCreating: boolean;
  readonly #isEditingAvatar: boolean;
  readonly #selectedContacts: ReadonlyArray<ContactListItemConversationType>;
  readonly #userAvatarData: ReadonlyArray<AvatarDataType>;

  constructor({
    groupAvatar,
    groupName,
    groupExpireTimer,
    hasError,
    isCreating,
    isEditingAvatar,
    selectedContacts,
    userAvatarData,
  }: Readonly<LeftPaneSetGroupMetadataPropsType>) {
    super();

    this.#groupAvatar = groupAvatar;
    this.#groupName = groupName;
    this.#groupExpireTimer = groupExpireTimer;
    this.#hasError = hasError;
    this.#isCreating = isCreating;
    this.#isEditingAvatar = isEditingAvatar;
    this.#selectedContacts = selectedContacts;
    this.#userAvatarData = userAvatarData;
  }

  override getHeaderContents({
    i18n,
    showChooseGroupMembers,
  }: Readonly<{
    i18n: LocalizerType;
    showChooseGroupMembers: () => void;
  }>): ReactChild {
    const backButtonLabel = i18n('icu:setGroupMetadata__back-button');

    return (
      <div className="module-left-pane__header__contents">
        <button
          aria-label={backButtonLabel}
          className="module-left-pane__header__contents__back-button"
          disabled={this.#isCreating}
          onClick={this.getBackAction({ showChooseGroupMembers })}
          title={backButtonLabel}
          type="button"
        />
        <div className="module-left-pane__header__contents__text">
          {i18n('icu:setGroupMetadata__title')}
        </div>
      </div>
    );
  }

  override getBackAction({
    showChooseGroupMembers,
  }: {
    showChooseGroupMembers: () => void;
  }): undefined | (() => void) {
    return this.#isCreating ? undefined : showChooseGroupMembers;
  }

  override getPreRowsNode({
    clearGroupCreationError,
    composeDeleteAvatarFromDisk,
    composeReplaceAvatar,
    composeSaveAvatarToDisk,
    createGroup,
    i18n,
    setComposeGroupAvatar,
    setComposeGroupExpireTimer,
    setComposeGroupName,
    toggleComposeEditingAvatar,
  }: Readonly<{
    clearGroupCreationError: () => unknown;
    composeDeleteAvatarFromDisk: DeleteAvatarFromDiskActionType;
    composeReplaceAvatar: ReplaceAvatarActionType;
    composeSaveAvatarToDisk: SaveAvatarToDiskActionType;
    createGroup: () => unknown;
    i18n: LocalizerType;
    setComposeGroupAvatar: (_: undefined | Uint8Array) => unknown;
    setComposeGroupExpireTimer: (_: DurationInSeconds) => void;
    setComposeGroupName: (_: string) => unknown;
    toggleComposeEditingAvatar: () => unknown;
  }>): ReactChild {
    const [avatarColor] = AvatarColors;
    const disabled = this.#isCreating;

    return (
      <form
        className="module-left-pane__header__form"
        onSubmit={event => {
          event.preventDefault();
          event.stopPropagation();

          if (!this.#canCreateGroup()) {
            return;
          }

          createGroup();
        }}
      >
        {this.#isEditingAvatar && (
          <Modal
            modalName="LeftPaneSetGroupMetadataHelper.AvatarEditor"
            hasXButton
            i18n={i18n}
            onClose={toggleComposeEditingAvatar}
            title={i18n(
              'icu:LeftPaneSetGroupMetadataHelper__avatar-modal-title'
            )}
          >
            <AvatarEditor
              avatarColor={avatarColor}
              avatarValue={this.#groupAvatar}
              deleteAvatarFromDisk={composeDeleteAvatarFromDisk}
              i18n={i18n}
              isGroup
              onCancel={toggleComposeEditingAvatar}
              onSave={newAvatar => {
                setComposeGroupAvatar(newAvatar);
                toggleComposeEditingAvatar();
              }}
              userAvatarData={this.#userAvatarData}
              replaceAvatar={composeReplaceAvatar}
              saveAvatarToDisk={composeSaveAvatarToDisk}
            />
          </Modal>
        )}
        <AvatarPreview
          avatarColor={avatarColor}
          avatarValue={this.#groupAvatar}
          i18n={i18n}
          isEditable
          isGroup
          onClick={toggleComposeEditingAvatar}
          style={{
            height: 96,
            margin: 0,
            width: 96,
          }}
        />
        <div className="module-GroupInput--container">
          <GroupTitleInput
            disabled={disabled}
            i18n={i18n}
            onChangeValue={setComposeGroupName}
            ref={focusRef}
            value={this.#groupName}
          />
        </div>

        <section className="module-left-pane__header__form__expire-timer">
          <div className="module-left-pane__header__form__expire-timer__label">
            {i18n('icu:disappearingMessages')}
          </div>
          <DisappearingTimerSelect
            i18n={i18n}
            value={this.#groupExpireTimer}
            onChange={setComposeGroupExpireTimer}
          />
        </section>

        {this.#hasError && (
          <Alert
            body={i18n('icu:setGroupMetadata__error-message')}
            i18n={i18n}
            onClose={clearGroupCreationError}
          />
        )}
      </form>
    );
  }

  override getFooterContents({
    createGroup,
    i18n,
  }: Readonly<{
    createGroup: () => unknown;
    i18n: LocalizerType;
  }>): ReactChild {
    return (
      <Button
        disabled={!this.#canCreateGroup()}
        onClick={() => {
          createGroup();
        }}
      >
        {this.#isCreating ? (
          <span aria-label={i18n('icu:loading')} role="status">
            <Spinner size="20px" svgSize="small" direction="on-avatar" />
          </span>
        ) : (
          i18n('icu:setGroupMetadata__create-group')
        )}
      </Button>
    );
  }

  getRowCount(): number {
    if (!this.#selectedContacts.length) {
      return 0;
    }
    return this.#selectedContacts.length + 2;
  }

  getRow(rowIndex: number): undefined | Row {
    if (!this.#selectedContacts.length) {
      return undefined;
    }

    if (rowIndex === 0) {
      return {
        type: RowType.Header,
        getHeaderText: i18n => i18n('icu:setGroupMetadata__members-header'),
      };
    }

    // This puts a blank row for the footer.
    if (rowIndex === this.#selectedContacts.length + 1) {
      return { type: RowType.Blank };
    }

    const contact = this.#selectedContacts[rowIndex - 1];
    return contact
      ? {
          type: RowType.Contact,
          contact,
          isClickable: false,
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

  #canCreateGroup(): boolean {
    return !this.#isCreating && Boolean(this.#groupName.trim());
  }
}

function focusRef(el: HTMLElement | null) {
  if (el) {
    el.focus();
  }
}
