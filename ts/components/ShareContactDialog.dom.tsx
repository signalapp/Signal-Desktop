// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import { useCallback, useId, useMemo, useState } from 'react';
import { RadioGroup } from 'radix-ui';
import { AxoDialog } from '../axo/AxoDialog.dom.tsx';
import { AxoSearchField } from '../axo/fields/AxoSearchField.dom.tsx';
import { AxoTextField } from '../axo/fields/AxoTextField.dom.tsx';
import { AxoFieldList } from '../axo/items/AxoFieldList.dom.tsx';
import { AxoContactList } from '../axo/items/AxoContactList.dom.tsx';
import { AxoList } from '../axo/items/AxoList.dom.tsx';
import { AxoItem } from '../axo/items/AxoItem.dom.tsx';
import { AxoCheckbox } from '../axo/AxoCheckbox.dom.tsx';
import { AxoSymbol } from '../axo/AxoSymbol.dom.tsx';
import { AxoAvatar } from '../axo/AxoAvatar.dom.tsx';
import { AxoTokens } from '../axo/AxoTokens.std.ts';
import { tw } from '../axo/tw.dom.tsx';
import type { ConversationType } from '../state/ducks/conversations.preload.ts';
import type { EmbeddedContactName } from '../types/EmbeddedContact.std.ts';
import type { LocalizerType, ThemeType } from '../types/Util.std.ts';
import type { PreferredBadgeSelectorType } from '../state/selectors/badges.preload.ts';
import { format as formatPhoneNumber } from '../types/PhoneNumber.std.ts';
import { combineNames } from '../util/combineNames.std.ts';
import { getInitials } from '../util/getInitials.std.ts';
import { filterAndSortConversations } from '../util/filterAndSortConversations.std.ts';
import { groupByFirstInitial } from '../util/groupByFirstInitial.std.ts';
import type {
  ShareContactAvatarType,
  ShareContactDraftType,
  ShareContactSelectionType,
  ShareContactType,
} from '../util/shareContact.std.ts';
import {
  applyShareContactSelection,
  canShareContact,
  getDefaultShareContactSelection,
  withE164AsMissingName,
} from '../util/shareContact.std.ts';
import type { Row } from './ConversationList.dom.tsx';
import { ConversationList, RowType } from './ConversationList.dom.tsx';
import { SizeObserver } from '../hooks/useSizeObserver.dom.tsx';
import {
  asyncShouldNeverBeCalled,
  shouldNeverBeCalled,
} from '../util/shouldNeverBeCalled.std.ts';
import { I18n } from './I18n.dom.tsx';
import { UserText } from './UserText.dom.tsx';
import { strictAssert } from '../util/assert.std.ts';
import { missingCaseError } from '../util/missingCaseError.std.ts';

type ShareSelectedContactStep = 'share' | 'editName' | 'selectPhoto';

export type ShareContactDialogProps = Readonly<{
  i18n: LocalizerType;
  theme: ThemeType;
  getPreferredBadge: PreferredBadgeSelectorType;
  contacts: ReadonlyArray<ConversationType>;
  recipientTitle: string;
  ourRegionCode: string | undefined;
  getContactDraft: (conversationId: string) => ShareContactDraftType;
  onClose: () => void;
  onShareContact: (contact: ShareContactType) => void;
}>;

type SelectedContact = Readonly<{
  conversation: ConversationType;
  draft: ShareContactDraftType;
}>;

type ShareContactState =
  | {
      step: 'selectContact';
      selectedContact?: never;
    }
  | {
      step: ShareSelectedContactStep;
      selectedContact: SelectedContact;
    };

export function ShareContactDialog(props: ShareContactDialogProps): ReactNode {
  const { i18n, contacts, getContactDraft, onClose, onShareContact } = props;

  const [state, setState] = useState<ShareContactState>({
    step: 'selectContact',
  });

  const handleSelectContact = useCallback(
    (conversation: ConversationType) => {
      setState({
        selectedContact: {
          conversation,
          draft: getContactDraft(conversation.id),
        },
        step: 'share',
      });
    },
    [getContactDraft]
  );

  const onStepChange = useCallback((step: ShareSelectedContactStep) => {
    setState(currentState => {
      strictAssert(currentState.selectedContact, 'contact must be selected');

      return { ...currentState, step };
    });
  }, []);

  const handleBack = useCallback(() => {
    setState({ step: 'selectContact' });
  }, []);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        return;
      }

      switch (state.step) {
        case 'editName':
        case 'selectPhoto':
          setState({ ...state, step: 'share' });
          return;
        case 'share':
        case 'selectContact':
          onClose();
          return;
        default:
          throw missingCaseError(state);
      }
    },
    [onClose, state]
  );

  return (
    <AxoDialog.Root open onOpenChange={handleOpenChange}>
      <AxoDialog.Content
        size={state.step === 'selectPhoto' ? 'sm' : 'md'}
        escape="cancel-is-noop"
      >
        {state.step === 'selectContact' ? (
          <SelectContact
            i18n={i18n}
            theme={props.theme}
            getPreferredBadge={props.getPreferredBadge}
            contacts={contacts}
            ourRegionCode={props.ourRegionCode}
            onSelectContact={handleSelectContact}
          />
        ) : (
          <ShareSelectedContactStep
            key={state.selectedContact.conversation.id}
            i18n={i18n}
            conversation={state.selectedContact.conversation}
            draft={state.selectedContact.draft}
            recipientTitle={props.recipientTitle}
            ourRegionCode={props.ourRegionCode}
            step={state.step}
            onStepChange={onStepChange}
            onBack={handleBack}
            onSend={onShareContact}
          />
        )}
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}

type SelectContactProps = Readonly<{
  i18n: LocalizerType;
  theme: ThemeType;
  getPreferredBadge: PreferredBadgeSelectorType;
  contacts: ReadonlyArray<ConversationType>;
  ourRegionCode: string | undefined;
  onSelectContact: (conversation: ConversationType) => void;
}>;

// Prefer the system contact name over profile name when sharing
function withSystemContactTitle(contact: ConversationType): ConversationType {
  const systemName =
    combineNames(contact.systemGivenName, contact.systemFamilyName) ||
    contact.systemNickname;
  if (!systemName) {
    return contact;
  }
  return { ...contact, title: systemName, titleNoDefault: systemName };
}

function SelectContact(props: SelectContactProps): ReactNode {
  const { i18n, contacts, ourRegionCode, onSelectContact } = props;
  const [searchValue, setSearchValue] = useState('');
  const searchQuery = searchValue.trim();

  const displayContacts = useMemo(() => {
    return contacts.map(withSystemContactTitle);
  }, [contacts]);

  const sortedContacts = useMemo(() => {
    const sorted = displayContacts.toSorted((a, b) =>
      a.title.localeCompare(b.title)
    );
    const sections = groupByFirstInitial(sorted, contact => {
      return contact.titleNoDefault ?? '';
    });
    return sections.flatMap(section => section.items);
  }, [displayContacts]);

  const visibleContacts = useMemo(() => {
    if (searchQuery === '') {
      return sortedContacts;
    }
    return filterAndSortConversations(
      displayContacts,
      searchQuery,
      ourRegionCode
    );
  }, [displayContacts, sortedContacts, searchQuery, ourRegionCode]);

  const rows = useMemo((): ReadonlyArray<Row> => {
    return visibleContacts.map(contact => {
      return { type: RowType.Contact, contact, hasContextMenu: false };
    });
  }, [visibleContacts]);

  const getRow = useCallback(
    (index: number): Row | undefined => {
      return rows[index];
    },
    [rows]
  );

  const handleSelectConversation = useCallback(
    (conversationId: string) => {
      const contact = contacts.find(({ id }) => id === conversationId);
      strictAssert(contact, 'Selected contact must be in the list');
      onSelectContact(contact);
    },
    [contacts, onSelectContact]
  );

  let emptyState: ReactNode;
  if (rows.length === 0) {
    emptyState =
      searchQuery === '' ? (
        i18n('icu:ShareContactDialog__SelectContact__EmptyState')
      ) : (
        <I18n
          i18n={i18n}
          id="icu:ShareContactDialog__SelectContact__NoResults"
          components={{
            searchQuery: <UserText text={searchQuery} />,
          }}
        />
      );
  }

  return (
    <>
      <AxoDialog.Header>
        <AxoDialog.Title>
          {i18n('icu:ShareContactDialog__SelectContact__Title')}
        </AxoDialog.Title>
        <AxoDialog.Close />
      </AxoDialog.Header>
      <AxoDialog.Search>
        <AxoSearchField.Root value={searchValue} onValueChange={setSearchValue}>
          <AxoSearchField.Icon />
          <AxoSearchField.Input
            placeholder={i18n(
              'icu:ShareContactDialog__SelectContact__SearchPlaceholder'
            )}
            autoFocus
          />
          <AxoSearchField.Clear />
        </AxoSearchField.Root>
      </AxoDialog.Search>
      <AxoDialog.Body
        scrollbarWidth="none"
        // ConversationList has its own scroll container so we need to do this
        padding="deprecated-only-scrollbar-gutter"
      >
        {emptyState != null ? (
          <div className={tw('h-110 px-4 pt-4')}>
            <AxoContactList.Root>
              <AxoContactList.EmptyStateItem title={emptyState} />
            </AxoContactList.Root>
          </div>
        ) : (
          <SizeObserver>
            {(ref, size) => {
              return (
                <div ref={ref} className={tw('h-110 w-full text-primary')}>
                  {size != null && !size.hidden && (
                    <ConversationList
                      dimensions={size}
                      i18n={i18n}
                      getPreferredBadge={props.getPreferredBadge}
                      getRow={getRow}
                      onSelectConversation={handleSelectConversation}
                      rowCount={rows.length}
                      shouldRecomputeRowHeights={false}
                      resetShouldRecomputeRowHeights={shouldNeverBeCalled}
                      theme={props.theme}
                      // never called:
                      blockConversation={shouldNeverBeCalled}
                      lookupConversationWithoutServiceId={
                        asyncShouldNeverBeCalled
                      }
                      onClickArchiveButton={shouldNeverBeCalled}
                      onClickClearFilterButton={shouldNeverBeCalled}
                      onClickContactCheckbox={shouldNeverBeCalled}
                      onOutgoingAudioCallInConversation={shouldNeverBeCalled}
                      onOutgoingVideoCallInConversation={shouldNeverBeCalled}
                      onPreloadConversation={shouldNeverBeCalled}
                      removeConversation={shouldNeverBeCalled}
                      setIsFetchingUUID={shouldNeverBeCalled}
                      showChooseGroupMembers={shouldNeverBeCalled}
                      showConversation={shouldNeverBeCalled}
                      showFindByPhoneNumber={shouldNeverBeCalled}
                      showFindByUsername={shouldNeverBeCalled}
                      showUserNotFoundModal={shouldNeverBeCalled}
                    />
                  )}
                </div>
              );
            }}
          </SizeObserver>
        )}
      </AxoDialog.Body>
    </>
  );
}

type ShareSelectedContactStepProps = Readonly<{
  i18n: LocalizerType;
  conversation: ConversationType;
  draft: ShareContactDraftType;
  recipientTitle: string;
  ourRegionCode: string | undefined;
  step: ShareSelectedContactStep;
  onStepChange: (step: ShareSelectedContactStep) => void;
  onBack: () => void;
  onSend: (contact: ShareContactType) => void;
}>;

function ShareSelectedContactStep(
  props: ShareSelectedContactStepProps
): ReactNode {
  const { i18n, conversation, ourRegionCode, onSend } = props;

  const [draft, setDraft] = useState(() => {
    return withE164AsMissingName(props.draft, ourRegionCode);
  });
  const { step, onStepChange } = props;

  const [selection, setSelection] = useState(() =>
    getDefaultShareContactSelection(draft)
  );

  const contact = useMemo(() => {
    return applyShareContactSelection(draft, selection);
  }, [draft, selection]);

  const handleSend = useCallback(() => {
    onSend(contact);
  }, [onSend, contact]);

  const toggle = useCallback(
    (key: keyof ShareContactSelectionType, checked: boolean) => {
      setSelection(prev => ({ ...prev, [key]: checked }));
    },
    []
  );

  const handleEditName = useCallback(() => {
    onStepChange('editName');
  }, [onStepChange]);

  const handleSelectPhoto = useCallback(() => {
    onStepChange('selectPhoto');
  }, [onStepChange]);

  const handleCancelEdit = useCallback(() => {
    onStepChange('share');
  }, [onStepChange]);

  const handleSaveName = useCallback(
    (editedName: EmbeddedContactName, organization: string | null) => {
      setDraft(prev => ({ ...prev, name: editedName, organization }));
      onStepChange('share');
    },
    [onStepChange]
  );

  const handleSavePhoto = useCallback(
    (avatar: ShareContactAvatarType | null) => {
      setDraft(prev => ({ ...prev, avatar }));
      onStepChange('share');
    },
    [onStepChange]
  );

  const name = combineNames(draft.name?.givenName, draft.name?.familyName);
  const nickname = combineNames(
    draft.nickname?.givenName,
    draft.nickname?.familyName
  );

  if (step === 'editName') {
    return (
      <EditNameStep
        i18n={i18n}
        name={draft.name}
        organization={draft.organization}
        onCancel={handleCancelEdit}
        onSave={handleSaveName}
      />
    );
  }

  if (step === 'selectPhoto') {
    return (
      <SelectPhotoStep
        i18n={i18n}
        conversation={conversation}
        avatar={draft.avatar}
        avatarOptions={draft.avatarOptions}
        onCancel={handleCancelEdit}
        onSave={handleSavePhoto}
      />
    );
  }

  return (
    <>
      <AxoDialog.Header>
        <AxoDialog.Back onClick={props.onBack} />
        <AxoDialog.Title>
          {i18n('icu:ShareContactDialog__ShareContact__Title')}
        </AxoDialog.Title>
        <AxoDialog.Close />
      </AxoDialog.Header>
      <AxoDialog.Body padding="md">
        <div className={tw('flex flex-col gap-3 pb-2')}>
          {draft.aci != null && (
            <AxoDialog.Description>
              <p className={tw('px-3 type-body-small text-secondary')}>
                <I18n
                  i18n={i18n}
                  id="icu:ShareContactDialog__ShareContact__Description"
                  components={{
                    name: <UserText text={conversation.title} />,
                  }}
                />
              </p>
            </AxoDialog.Description>
          )}
          <AxoList.Root>
            <AxoList.Body>
              <AxoItem.Group>
                {draft.avatarOptions.length > 0 && (
                  <EditableFieldItem
                    editLabel={i18n(
                      'icu:ShareContactDialog__ShareContact__EditPhoto'
                    )}
                    onEdit={handleSelectPhoto}
                  >
                    <ConversationAvatar
                      conversation={conversation}
                      avatarUrl={draft.avatar?.url}
                      size={48}
                      label={getPhotoLabel(i18n, draft.avatar)}
                    />
                  </EditableFieldItem>
                )}
                {name != null && (
                  <EditableFieldItem
                    editLabel={i18n(
                      'icu:ShareContactDialog__ShareContact__EditName'
                    )}
                    onEdit={handleEditName}
                  >
                    <UserText text={name} />
                  </EditableFieldItem>
                )}
                {draft.e164 != null && (
                  <FieldItem
                    label={i18n('icu:phone-v2')}
                    checked={selection.e164}
                    onCheckedChange={checked => toggle('e164', checked)}
                  >
                    {formatPhoneNumber(draft.e164, { ourRegionCode })}
                  </FieldItem>
                )}
                {nickname != null && (
                  <FieldItem
                    label={i18n('icu:ContactDetail__nickname')}
                    checked={selection.nickname}
                    onCheckedChange={checked => toggle('nickname', checked)}
                  >
                    <UserText text={nickname} />
                  </FieldItem>
                )}
                {draft.note != null && (
                  <FieldItem
                    label={i18n('icu:ContactDetail__note')}
                    checked={selection.note}
                    onCheckedChange={checked => toggle('note', checked)}
                  >
                    <span className={tw('whitespace-pre-wrap')}>
                      <UserText text={draft.note} />
                    </span>
                  </FieldItem>
                )}
              </AxoItem.Group>
            </AxoList.Body>
          </AxoList.Root>
        </div>
      </AxoDialog.Body>
      <AxoDialog.Footer>
        <AxoDialog.FooterContent>
          <UserText text={props.recipientTitle} />
        </AxoDialog.FooterContent>
        <AxoDialog.Actions>
          <AxoDialog.IconAction
            variant="strong-primary"
            symbol="arrow-up"
            label={i18n('icu:ShareContactDialog__ShareContact__Send')}
            disabled={!canShareContact(contact)}
            onClick={handleSend}
          />
        </AxoDialog.Actions>
      </AxoDialog.Footer>
    </>
  );
}

/** Select photo */
const DEFAULT_PHOTO_VALUE = 'default';

function getPhotoValue(avatar: ShareContactAvatarType | null): string {
  if (avatar == null) {
    return DEFAULT_PHOTO_VALUE;
  }
  return avatar.isProfile ? 'profile' : 'system';
}

function getPhotoLabel(
  i18n: LocalizerType,
  avatar: ShareContactAvatarType | null
): string {
  if (avatar == null) {
    return i18n('icu:ShareContactDialog__SelectPhoto__DefaultAvatar');
  }
  return avatar.isProfile
    ? i18n('icu:ShareContactDialog__SelectPhoto__ProfilePhoto')
    : i18n('icu:ShareContactDialog__SelectPhoto__ContactPhoto');
}

type SelectPhotoStepProps = Readonly<{
  i18n: LocalizerType;
  conversation: ConversationType;
  avatar: ShareContactAvatarType | null;
  avatarOptions: ReadonlyArray<ShareContactAvatarType>;
  onCancel: () => void;
  onSave: (avatar: ShareContactAvatarType | null) => void;
}>;

function SelectPhotoStep(props: SelectPhotoStepProps): ReactNode {
  const { i18n, conversation, avatarOptions, onSave } = props;

  const [value, setValue] = useState(() => getPhotoValue(props.avatar));

  const handleSave = useCallback(() => {
    onSave(
      avatarOptions.find(option => getPhotoValue(option) === value) ?? null
    );
  }, [onSave, avatarOptions, value]);

  return (
    <>
      <AxoDialog.Header>
        <AxoDialog.Back onClick={props.onCancel} />
        <AxoDialog.Title>
          {i18n('icu:ShareContactDialog__SelectPhoto__Title')}
        </AxoDialog.Title>
      </AxoDialog.Header>
      <AxoDialog.Body padding="md">
        <RadioGroup.Root
          value={value}
          onValueChange={setValue}
          orientation="horizontal"
          aria-label={i18n('icu:ShareContactDialog__SelectPhoto__Title')}
          className={tw('flex justify-center gap-3 pt-2 pb-5')}
        >
          {avatarOptions.map(option => {
            return (
              <PhotoOption
                key={getPhotoValue(option)}
                conversation={conversation}
                value={getPhotoValue(option)}
                checked={getPhotoValue(option) === value}
                label={getPhotoLabel(i18n, option)}
                avatarUrl={option.url}
              />
            );
          })}
          <PhotoOption
            conversation={conversation}
            value={DEFAULT_PHOTO_VALUE}
            checked={value === DEFAULT_PHOTO_VALUE}
            label={getPhotoLabel(i18n, null)}
            avatarUrl={undefined}
          />
        </RadioGroup.Root>
      </AxoDialog.Body>
      <AxoDialog.Footer>
        <AxoDialog.Actions>
          <AxoDialog.Action variant="subtle-secondary" onClick={props.onCancel}>
            {i18n('icu:cancel')}
          </AxoDialog.Action>
          <AxoDialog.Action variant="strong-primary" onClick={handleSave}>
            {i18n('icu:done')}
          </AxoDialog.Action>
        </AxoDialog.Actions>
      </AxoDialog.Footer>
    </>
  );
}

type PhotoOptionProps = Readonly<{
  conversation: ConversationType;
  value: string;
  checked: boolean;
  label: string;
  avatarUrl: string | undefined;
}>;

function PhotoOption(props: PhotoOptionProps): ReactNode {
  return (
    <RadioGroup.Item
      value={props.value}
      aria-label={props.label}
      className={tw('relative rounded-full', 'focus-visible:axo-focus-ring')}
    >
      <ConversationAvatar
        conversation={props.conversation}
        avatarUrl={props.avatarUrl}
        size={80}
        // Labeled above
        label={null}
      />
      <span
        className={tw(
          'absolute inset-e-0 bottom-0',
          'flex size-5 items-center justify-center rounded-full',
          'border border-secondary',
          props.checked
            ? 'bg-accent text-primary-oncolor'
            : 'bg-control inset-shadow-on-color'
        )}
      >
        {props.checked && (
          <AxoSymbol.Icon symbol="check" size={14} label={null} />
        )}
      </span>
    </RadioGroup.Item>
  );
}

/** Edit name */
// These are not enforced by other clients or at receive time yet
const NAME_FIELD_MAX_GRAPHEMES = 128;
const NAME_FIELD_MAX_BYTES = 512;

type EditNameStepProps = Readonly<{
  i18n: LocalizerType;
  name: EmbeddedContactName | null;
  organization: string | null;
  onCancel: () => void;
  onSave: (name: EmbeddedContactName, organization: string | null) => void;
}>;

function EditNameStep(props: EditNameStepProps): ReactNode {
  const { i18n, onSave } = props;

  const [prefix, setPrefix] = useState(props.name?.prefix ?? '');
  const [givenName, setGivenName] = useState(props.name?.givenName ?? '');
  const [middleName, setMiddleName] = useState(props.name?.middleName ?? '');
  const [familyName, setFamilyName] = useState(props.name?.familyName ?? '');
  const [suffix, setSuffix] = useState(props.name?.suffix ?? '');
  const [organization, setOrganization] = useState(props.organization ?? '');

  const canSave = givenName.trim() || familyName.trim();

  const handleSave = useCallback(() => {
    onSave(
      {
        prefix: prefix.trim() || undefined,
        givenName: givenName.trim() || undefined,
        middleName: middleName.trim() || undefined,
        familyName: familyName.trim() || undefined,
        suffix: suffix.trim() || undefined,
      },
      organization.trim() || null
    );
  }, [onSave, prefix, givenName, middleName, familyName, suffix, organization]);

  return (
    <>
      <AxoDialog.Header>
        <AxoDialog.Back onClick={props.onCancel} />
        <AxoDialog.Title>
          {i18n('icu:ShareContactDialog__EditName__Title')}
        </AxoDialog.Title>
      </AxoDialog.Header>
      <AxoDialog.Body padding="md">
        <div className={tw('pb-2')}>
          <AxoFieldList.Root>
            <NameField
              label={i18n('icu:ShareContactDialog__EditName__Prefix')}
              value={prefix}
              onValueChange={setPrefix}
            />
            <NameField
              label={i18n('icu:ShareContactDialog__EditName__GivenName')}
              value={givenName}
              onValueChange={setGivenName}
              autoFocus
            />
            <NameField
              label={i18n('icu:ShareContactDialog__EditName__MiddleName')}
              value={middleName}
              onValueChange={setMiddleName}
            />
            <NameField
              label={i18n('icu:ShareContactDialog__EditName__FamilyName')}
              value={familyName}
              onValueChange={setFamilyName}
            />
            <NameField
              label={i18n('icu:ShareContactDialog__EditName__Suffix')}
              value={suffix}
              onValueChange={setSuffix}
            />
            <NameField
              label={i18n('icu:ShareContactDialog__EditName__Organization')}
              value={organization}
              onValueChange={setOrganization}
            />
          </AxoFieldList.Root>
        </div>
      </AxoDialog.Body>
      <AxoDialog.Footer>
        <AxoDialog.Actions>
          <AxoDialog.Action variant="subtle-secondary" onClick={props.onCancel}>
            {i18n('icu:cancel')}
          </AxoDialog.Action>
          <AxoDialog.Action
            variant="strong-primary"
            disabled={!canSave}
            onClick={handleSave}
          >
            {i18n('icu:done')}
          </AxoDialog.Action>
        </AxoDialog.Actions>
      </AxoDialog.Footer>
    </>
  );
}

type NameFieldProps = Readonly<{
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  autoFocus?: boolean;
}>;

function NameField(props: NameFieldProps): ReactNode {
  const id = useId();
  return (
    <AxoFieldList.Item>
      <label htmlFor={id} className={tw('sr-only')}>
        {props.label}
      </label>
      <AxoTextField.Root
        id={id}
        value={props.value}
        onValueChange={props.onValueChange}
        maxGraphemes={NAME_FIELD_MAX_GRAPHEMES}
        maxBytes={NAME_FIELD_MAX_BYTES}
      >
        <AxoTextField.Input
          placeholder={props.label}
          autoFocus={props.autoFocus}
        />
      </AxoTextField.Root>
    </AxoFieldList.Item>
  );
}

type FieldItemProps = Readonly<{
  label?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children: ReactNode;
}>;

function FieldItem(props: FieldItemProps): ReactNode {
  const id = useId();
  return (
    <AxoItem.Root>
      <AxoItem.Leading centerToFullHeight>
        <AxoCheckbox.Root
          id={id}
          variant="round"
          checked={props.checked}
          onCheckedChange={props.onCheckedChange}
        />
      </AxoItem.Leading>
      <AxoItem.Content>
        <AxoItem.Label>
          <label htmlFor={id} className={tw('block cursor-pointer')}>
            {props.label != null && (
              <span className={tw('block type-body-small text-secondary')}>
                {props.label}
              </span>
            )}
            <span className={tw('block type-body-large text-primary')}>
              {props.children}
            </span>
          </label>
        </AxoItem.Label>
      </AxoItem.Content>
    </AxoItem.Root>
  );
}

type EditableFieldItemProps = Readonly<{
  editLabel: string;
  onEdit: () => void;
  children: ReactNode;
}>;

function EditableFieldItem(props: EditableFieldItemProps): ReactNode {
  return (
    <AxoItem.Root>
      <AxoItem.Leading centerToFullHeight>
        {/* These fields cannot be disabled, so it's not a true checkbox */}
        <span
          aria-hidden
          className={tw(
            'flex size-5 items-center justify-center rounded-full',
            'border border-secondary bg-accent text-primary-oncolor'
          )}
        >
          <AxoSymbol.Icon symbol="check" size={14} label={null} />
        </span>
      </AxoItem.Leading>
      <AxoItem.Content>
        <AxoItem.Label>
          <span className={tw('block type-body-large text-primary')}>
            {props.children}
          </span>
        </AxoItem.Label>
        <AxoItem.HiddenTrigger label={props.editLabel} onClick={props.onEdit} />
        <AxoItem.Accessory centerToFullHeight>
          <AxoSymbol.Icon symbol="pencil" size={20} label={null} />
        </AxoItem.Accessory>
      </AxoItem.Content>
    </AxoItem.Root>
  );
}

const DEFAULT_AVATAR_COLOR: AxoTokens.Avatar.ColorName = 'A200';

function ConversationAvatar(
  props: Readonly<{
    conversation: ConversationType;
    avatarUrl: string | undefined;
    size: AxoAvatar.Size;
    label: string | null;
  }>
): ReactNode {
  const { conversation, avatarUrl, size, label } = props;

  const color =
    conversation.color != null &&
    AxoTokens.Avatar.isColorName(conversation.color)
      ? conversation.color
      : DEFAULT_AVATAR_COLOR;
  const initials = getInitials(conversation.title);

  let content: ReactNode;
  if (avatarUrl) {
    content = (
      <AxoAvatar.Image
        src={avatarUrl}
        srcWidth={size}
        srcHeight={size}
        blur={false}
        fallbackIcon="person"
        fallbackColor={color}
      />
    );
  } else if (initials) {
    content = <AxoAvatar.Initials initials={initials} color={color} />;
  } else {
    content = <AxoAvatar.Icon symbol="person" color={color} />;
  }

  return (
    <AxoAvatar.Root size={size}>
      <AxoAvatar.Content label={label}>{content}</AxoAvatar.Content>
    </AxoAvatar.Root>
  );
}
