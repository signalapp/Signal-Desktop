// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { FunctionComponent } from 'react';
import React, { useEffect, useMemo, useState, useRef } from 'react';
import type { MeasuredComponentProps } from 'react-measure';
import Measure from 'react-measure';

import type { LocalizerType, ThemeType } from '../../../../types/Util';
import { assert } from '../../../../util/assert';
import { getOwn } from '../../../../util/getOwn';
import { refMerger } from '../../../../util/refMerger';
import { useRestoreFocus } from '../../../../hooks/useRestoreFocus';
import { missingCaseError } from '../../../../util/missingCaseError';
import { filterAndSortConversationsByTitle } from '../../../../util/filterAndSortConversations';
import type { ConversationType } from '../../../../state/ducks/conversations';
import type { PreferredBadgeSelectorType } from '../../../../state/selectors/badges';
import { ModalHost } from '../../../ModalHost';
import { ContactPills } from '../../../ContactPills';
import { ContactPill } from '../../../ContactPill';
import type { Row } from '../../../ConversationList';
import { ConversationList, RowType } from '../../../ConversationList';
import { ContactCheckboxDisabledReason } from '../../../conversationList/ContactCheckbox';
import { Button, ButtonVariant } from '../../../Button';
import { SearchInput } from '../../../SearchInput';

type PropsType = {
  candidateContacts: ReadonlyArray<ConversationType>;
  confirmAdds: () => void;
  contactLookup: Record<string, ConversationType>;
  conversationIdsAlreadyInGroup: Set<string>;
  getPreferredBadge: PreferredBadgeSelectorType;
  i18n: LocalizerType;
  maxGroupSize: number;
  onClose: () => void;
  removeSelectedContact: (_: string) => void;
  searchTerm: string;
  selectedContacts: ReadonlyArray<ConversationType>;
  setCantAddContactForModal: (
    _: Readonly<undefined | ConversationType>
  ) => void;
  setSearchTerm: (_: string) => void;
  theme: ThemeType;
  toggleSelectedContact: (conversationId: string) => void;
};

// TODO: This should use <Modal>. See DESKTOP-1038.
export const ChooseGroupMembersModal: FunctionComponent<PropsType> = ({
  candidateContacts,
  confirmAdds,
  contactLookup,
  conversationIdsAlreadyInGroup,
  getPreferredBadge,
  i18n,
  maxGroupSize,
  onClose,
  removeSelectedContact,
  searchTerm,
  selectedContacts,
  setCantAddContactForModal,
  setSearchTerm,
  theme,
  toggleSelectedContact,
}) => {
  const [focusRef] = useRestoreFocus();

  const inputRef = useRef<null | HTMLInputElement>(null);

  const numberOfContactsAlreadyInGroup = conversationIdsAlreadyInGroup.size;

  const hasSelectedMaximumNumberOfContacts =
    selectedContacts.length + numberOfContactsAlreadyInGroup >= maxGroupSize;

  const selectedConversationIdsSet: Set<string> = useMemo(
    () => new Set(selectedContacts.map(contact => contact.id)),
    [selectedContacts]
  );

  const canContinue = Boolean(selectedContacts.length);

  const [filteredContacts, setFilteredContacts] = useState(
    filterAndSortConversationsByTitle(candidateContacts, '')
  );
  const normalizedSearchTerm = searchTerm.trim();
  useEffect(() => {
    const timeout = setTimeout(() => {
      setFilteredContacts(
        filterAndSortConversationsByTitle(
          candidateContacts,
          normalizedSearchTerm
        )
      );
    }, 200);
    return () => {
      clearTimeout(timeout);
    };
  }, [candidateContacts, normalizedSearchTerm, setFilteredContacts]);

  const rowCount = filteredContacts.length;
  const getRow = (index: number): undefined | Row => {
    const contact = filteredContacts[index];
    if (!contact) {
      return undefined;
    }

    const isSelected = selectedConversationIdsSet.has(contact.id);
    const isAlreadyInGroup = conversationIdsAlreadyInGroup.has(contact.id);

    let disabledReason: undefined | ContactCheckboxDisabledReason;
    if (isAlreadyInGroup) {
      disabledReason = ContactCheckboxDisabledReason.AlreadyAdded;
    } else if (hasSelectedMaximumNumberOfContacts && !isSelected) {
      disabledReason = ContactCheckboxDisabledReason.MaximumContactsSelected;
    } else if (!contact.isGroupV2Capable) {
      disabledReason = ContactCheckboxDisabledReason.NotCapable;
    }

    return {
      type: RowType.ContactCheckbox,
      contact,
      isChecked: isSelected || isAlreadyInGroup,
      disabledReason,
    };
  };

  return (
    <ModalHost onClose={onClose}>
      <div className="module-AddGroupMembersModal module-AddGroupMembersModal--choose-members">
        <button
          aria-label={i18n('close')}
          className="module-AddGroupMembersModal__close-button"
          type="button"
          onClick={() => {
            onClose();
          }}
        />
        <h1 className="module-AddGroupMembersModal__header">
          {i18n('AddGroupMembersModal--title')}
        </h1>
        <SearchInput
          disabled={candidateContacts.length === 0}
          placeholder={i18n('contactSearchPlaceholder')}
          onChange={event => {
            setSearchTerm(event.target.value);
          }}
          onKeyDown={event => {
            if (canContinue && event.key === 'Enter') {
              confirmAdds();
            }
          }}
          ref={refMerger<HTMLInputElement>(inputRef, focusRef)}
          value={searchTerm}
        />
        {Boolean(selectedContacts.length) && (
          <ContactPills>
            {selectedContacts.map(contact => (
              <ContactPill
                key={contact.id}
                acceptedMessageRequest={contact.acceptedMessageRequest}
                avatarPath={contact.avatarPath}
                color={contact.color}
                firstName={contact.firstName}
                i18n={i18n}
                isMe={contact.isMe}
                id={contact.id}
                name={contact.name}
                phoneNumber={contact.phoneNumber}
                profileName={contact.profileName}
                sharedGroupNames={contact.sharedGroupNames}
                title={contact.title}
                onClickRemove={() => {
                  removeSelectedContact(contact.id);
                }}
              />
            ))}
          </ContactPills>
        )}
        {candidateContacts.length ? (
          <Measure bounds>
            {({ contentRect, measureRef }: MeasuredComponentProps) => {
              // We disable this ESLint rule because we're capturing a bubbled keydown
              //   event. See [this note in the jsx-a11y docs][0].
              //
              // [0]: https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/c275964f52c35775208bd00cb612c6f82e42e34f/docs/rules/no-static-element-interactions.md#case-the-event-handler-is-only-being-used-to-capture-bubbled-events
              /* eslint-disable jsx-a11y/no-static-element-interactions */
              return (
                <div
                  className="module-AddGroupMembersModal__list-wrapper"
                  ref={measureRef}
                  onKeyDown={event => {
                    if (event.key === 'Enter') {
                      inputRef.current?.focus();
                    }
                  }}
                >
                  <ConversationList
                    dimensions={contentRect.bounds}
                    getPreferredBadge={getPreferredBadge}
                    getRow={getRow}
                    i18n={i18n}
                    onClickArchiveButton={shouldNeverBeCalled}
                    onClickContactCheckbox={(
                      conversationId: string,
                      disabledReason: undefined | ContactCheckboxDisabledReason
                    ) => {
                      switch (disabledReason) {
                        case undefined:
                          toggleSelectedContact(conversationId);
                          break;
                        case ContactCheckboxDisabledReason.AlreadyAdded:
                        case ContactCheckboxDisabledReason.MaximumContactsSelected:
                          // These are no-ops.
                          break;
                        case ContactCheckboxDisabledReason.NotCapable: {
                          const contact = getOwn(contactLookup, conversationId);
                          assert(
                            contact,
                            'Contact was not in lookup; not showing modal'
                          );
                          setCantAddContactForModal(contact);
                          break;
                        }
                        default:
                          throw missingCaseError(disabledReason);
                      }
                    }}
                    onSelectConversation={shouldNeverBeCalled}
                    renderMessageSearchResult={() => {
                      shouldNeverBeCalled();
                      return <div />;
                    }}
                    rowCount={rowCount}
                    shouldRecomputeRowHeights={false}
                    showChooseGroupMembers={shouldNeverBeCalled}
                    startNewConversationFromPhoneNumber={shouldNeverBeCalled}
                    startNewConversationFromUsername={shouldNeverBeCalled}
                    theme={theme}
                  />
                </div>
              );
              /* eslint-enable jsx-a11y/no-static-element-interactions */
            }}
          </Measure>
        ) : (
          <div className="module-AddGroupMembersModal__no-candidate-contacts">
            {i18n('noContactsFound')}
          </div>
        )}
        <div className="module-AddGroupMembersModal__button-container">
          <Button onClick={onClose} variant={ButtonVariant.Secondary}>
            {i18n('cancel')}
          </Button>

          <Button disabled={!canContinue} onClick={confirmAdds}>
            {i18n('AddGroupMembersModal--continue-to-confirm')}
          </Button>
        </div>
      </div>
    </ModalHost>
  );
};

function shouldNeverBeCalled(..._args: ReadonlyArray<unknown>): unknown {
  assert(false, 'This should never be called. Doing nothing');
}
