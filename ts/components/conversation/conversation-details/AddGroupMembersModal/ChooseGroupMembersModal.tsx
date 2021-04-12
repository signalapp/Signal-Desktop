// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, {
  FunctionComponent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Measure, { MeasuredComponentProps } from 'react-measure';

import { LocalizerType } from '../../../../types/Util';
import { assert } from '../../../../util/assert';
import { getOwn } from '../../../../util/getOwn';
import { missingCaseError } from '../../../../util/missingCaseError';
import { filterAndSortContacts } from '../../../../util/filterAndSortContacts';
import { ConversationType } from '../../../../state/ducks/conversations';
import { ModalHost } from '../../../ModalHost';
import { ContactPills } from '../../../ContactPills';
import { ContactPill } from '../../../ContactPill';
import { ConversationList, Row, RowType } from '../../../ConversationList';
import { ContactCheckboxDisabledReason } from '../../../conversationList/ContactCheckbox';
import { Button, ButtonVariant } from '../../../Button';

type PropsType = {
  candidateContacts: ReadonlyArray<ConversationType>;
  confirmAdds: () => void;
  contactLookup: Record<string, ConversationType>;
  conversationIdsAlreadyInGroup: Set<string>;
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
  toggleSelectedContact: (conversationId: string) => void;
};

export const ChooseGroupMembersModal: FunctionComponent<PropsType> = ({
  candidateContacts,
  confirmAdds,
  contactLookup,
  conversationIdsAlreadyInGroup,
  i18n,
  maxGroupSize,
  onClose,
  removeSelectedContact,
  searchTerm,
  selectedContacts,
  setCantAddContactForModal,
  setSearchTerm,
  toggleSelectedContact,
}) => {
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
    filterAndSortContacts(candidateContacts, '')
  );
  const normalizedSearchTerm = searchTerm.trim();
  useEffect(() => {
    const timeout = setTimeout(() => {
      setFilteredContacts(
        filterAndSortContacts(candidateContacts, normalizedSearchTerm)
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
        <input
          type="text"
          className="module-AddGroupMembersModal__search-input"
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
          ref={inputRef}
          value={searchTerm}
        />
        {Boolean(selectedContacts.length) && (
          <ContactPills>
            {selectedContacts.map(contact => (
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
