// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { FunctionComponent } from 'react';
import React, {
  useEffect,
  useMemo,
  useState,
  useRef,
  useCallback,
} from 'react';
import { omit } from 'lodash';
import type { MeasuredComponentProps } from 'react-measure';
import Measure from 'react-measure';

import type { LocalizerType, ThemeType } from '../../../../types/Util';
import { getUsernameFromSearch } from '../../../../types/Username';
import { refMerger } from '../../../../util/refMerger';
import { useRestoreFocus } from '../../../../hooks/useRestoreFocus';
import { missingCaseError } from '../../../../util/missingCaseError';
import type { LookupConversationWithoutUuidActionsType } from '../../../../util/lookupConversationWithoutUuid';
import { parseAndFormatPhoneNumber } from '../../../../util/libphonenumberInstance';
import { filterAndSortConversationsByRecent } from '../../../../util/filterAndSortConversations';
import type { ConversationType } from '../../../../state/ducks/conversations';
import type { PreferredBadgeSelectorType } from '../../../../state/selectors/badges';
import type {
  UUIDFetchStateKeyType,
  UUIDFetchStateType,
} from '../../../../util/uuidFetchState';
import {
  isFetchingByE164,
  isFetchingByUsername,
} from '../../../../util/uuidFetchState';
import { ModalHost } from '../../../ModalHost';
import { ContactPills } from '../../../ContactPills';
import { ContactPill } from '../../../ContactPill';
import type { Row } from '../../../ConversationList';
import { ConversationList, RowType } from '../../../ConversationList';
import { ContactCheckboxDisabledReason } from '../../../conversationList/ContactCheckbox';
import { Button, ButtonVariant } from '../../../Button';
import { SearchInput } from '../../../SearchInput';
import { shouldNeverBeCalled } from '../../../../util/shouldNeverBeCalled';

export type StatePropsType = {
  regionCode: string | undefined;
  candidateContacts: ReadonlyArray<ConversationType>;
  conversationIdsAlreadyInGroup: Set<string>;
  getPreferredBadge: PreferredBadgeSelectorType;
  i18n: LocalizerType;
  theme: ThemeType;
  maxGroupSize: number;
  searchTerm: string;
  selectedContacts: ReadonlyArray<ConversationType>;

  confirmAdds: () => void;
  onClose: () => void;
  removeSelectedContact: (_: string) => void;
  setSearchTerm: (_: string) => void;
  toggleSelectedContact: (conversationId: string) => void;
  isUsernamesEnabled: boolean;
} & Pick<
  LookupConversationWithoutUuidActionsType,
  'lookupConversationWithoutUuid'
>;

type ActionPropsType = Omit<
  LookupConversationWithoutUuidActionsType,
  'setIsFetchingUUID' | 'lookupConversationWithoutUuid'
>;

type PropsType = StatePropsType & ActionPropsType;

// TODO: This should use <Modal>. See DESKTOP-1038.
export const ChooseGroupMembersModal: FunctionComponent<PropsType> = ({
  regionCode,
  candidateContacts,
  confirmAdds,
  conversationIdsAlreadyInGroup,
  getPreferredBadge,
  i18n,
  maxGroupSize,
  onClose,
  removeSelectedContact,
  searchTerm,
  selectedContacts,
  setSearchTerm,
  theme,
  toggleSelectedContact,
  lookupConversationWithoutUuid,
  showUserNotFoundModal,
  isUsernamesEnabled,
}) => {
  const [focusRef] = useRestoreFocus();

  const phoneNumber = parseAndFormatPhoneNumber(searchTerm, regionCode);

  let isPhoneNumberChecked = false;
  if (phoneNumber) {
    isPhoneNumberChecked =
      phoneNumber.isValid &&
      selectedContacts.some(contact => contact.e164 === phoneNumber.e164);
  }

  const isPhoneNumberVisible =
    phoneNumber &&
    candidateContacts.every(contact => contact.e164 !== phoneNumber.e164);

  let username: string | undefined;
  let isUsernameChecked = false;
  let isUsernameVisible = false;
  if (!phoneNumber && isUsernamesEnabled) {
    username = getUsernameFromSearch(searchTerm);

    isUsernameChecked = selectedContacts.some(
      contact => contact.username === username
    );

    isUsernameVisible =
      Boolean(username) &&
      candidateContacts.every(contact => contact.username !== username);
  }

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
    filterAndSortConversationsByRecent(candidateContacts, '', regionCode)
  );
  const normalizedSearchTerm = searchTerm.trim();
  useEffect(() => {
    const timeout = setTimeout(() => {
      setFilteredContacts(
        filterAndSortConversationsByRecent(
          candidateContacts,
          normalizedSearchTerm,
          regionCode
        )
      );
    }, 200);
    return () => {
      clearTimeout(timeout);
    };
  }, [
    candidateContacts,
    normalizedSearchTerm,
    setFilteredContacts,
    regionCode,
  ]);

  const [uuidFetchState, setUuidFetchState] = useState<UUIDFetchStateType>({});

  const setIsFetchingUUID = useCallback(
    (identifier: UUIDFetchStateKeyType, isFetching: boolean) => {
      setUuidFetchState(prevState => {
        return isFetching
          ? {
              ...prevState,
              [identifier]: isFetching,
            }
          : omit(prevState, identifier);
      });
    },
    [setUuidFetchState]
  );

  let rowCount = 0;
  if (filteredContacts.length) {
    rowCount += filteredContacts.length;
  }
  if (isPhoneNumberVisible || isUsernameVisible) {
    // "Contacts" header
    if (filteredContacts.length) {
      rowCount += 1;
    }

    // "Find by phone number" + phone number
    // or
    // "Find by username" + username
    rowCount += 2;
  }
  const getRow = (index: number): undefined | Row => {
    let virtualIndex = index;

    if (
      (isPhoneNumberVisible || isUsernameVisible) &&
      filteredContacts.length
    ) {
      if (virtualIndex === 0) {
        return {
          type: RowType.Header,
          i18nKey: 'contactsHeader',
        };
      }

      virtualIndex -= 1;
    }

    if (virtualIndex < filteredContacts.length) {
      const contact = filteredContacts[virtualIndex];

      const isSelected = selectedConversationIdsSet.has(contact.id);
      const isAlreadyInGroup = conversationIdsAlreadyInGroup.has(contact.id);

      let disabledReason: undefined | ContactCheckboxDisabledReason;
      if (isAlreadyInGroup) {
        disabledReason = ContactCheckboxDisabledReason.AlreadyAdded;
      } else if (hasSelectedMaximumNumberOfContacts && !isSelected) {
        disabledReason = ContactCheckboxDisabledReason.MaximumContactsSelected;
      }

      return {
        type: RowType.ContactCheckbox,
        contact,
        isChecked: isSelected || isAlreadyInGroup,
        disabledReason,
      };
    }

    virtualIndex -= filteredContacts.length;

    if (isPhoneNumberVisible) {
      if (virtualIndex === 0) {
        return {
          type: RowType.Header,
          i18nKey: 'findByPhoneNumberHeader',
        };
      }
      if (virtualIndex === 1) {
        return {
          type: RowType.PhoneNumberCheckbox,
          isChecked: isPhoneNumberChecked,
          isFetching: isFetchingByE164(uuidFetchState, phoneNumber.e164),
          phoneNumber,
        };
      }
      virtualIndex -= 2;
    }

    if (username) {
      if (virtualIndex === 0) {
        return {
          type: RowType.Header,
          i18nKey: 'findByUsernameHeader',
        };
      }
      if (virtualIndex === 1) {
        return {
          type: RowType.UsernameCheckbox,
          isChecked: isUsernameChecked,
          isFetching: isFetchingByUsername(uuidFetchState, username),
          username,
        };
      }
      virtualIndex -= 2;
    }

    return undefined;
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
          i18n={i18n}
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
        {rowCount ? (
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
                        default:
                          throw missingCaseError(disabledReason);
                      }
                    }}
                    lookupConversationWithoutUuid={
                      lookupConversationWithoutUuid
                    }
                    showUserNotFoundModal={showUserNotFoundModal}
                    setIsFetchingUUID={setIsFetchingUUID}
                    showConversation={shouldNeverBeCalled}
                    onSelectConversation={shouldNeverBeCalled}
                    renderMessageSearchResult={() => {
                      shouldNeverBeCalled();
                      return <div />;
                    }}
                    rowCount={rowCount}
                    shouldRecomputeRowHeights={false}
                    showChooseGroupMembers={shouldNeverBeCalled}
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
