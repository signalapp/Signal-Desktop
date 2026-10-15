// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useState, useEffect, type JSX, useCallback } from 'react';
import { Avatar, AvatarSize } from './Avatar.dom.tsx';
import { InContactsIcon } from './InContactsIcon.dom.tsx';
import type { ConversationType } from '../state/ducks/conversations.preload.ts';
import type { PreferredBadgeSelectorType } from '../state/selectors/badges.preload.ts';
import type { LocalizerType } from '../types/Util.std.ts';
import { ThemeType } from '../types/Util.std.ts';
import { isInSystemContacts } from '../util/isInSystemContacts.std.ts';
import { missingCaseError } from '../util/missingCaseError.std.ts';
import { ContextMenu } from './ContextMenu.dom.tsx';
import { Theme } from '../util/theme.std.ts';
import { isNotNil } from '../util/isNotNil.std.ts';
import { MY_STORY_ID } from '../types/Stories.std.ts';
import type { ServiceIdString } from '../types/ServiceId.std.ts';
import type { StoryDistributionIdString } from '../types/StoryDistributionId.std.ts';
import { UserText } from './UserText.dom.tsx';
import { AxoConfirmDialog } from '../axo/AxoConfirmDialog.dom.tsx';
import { AxoDialog } from '../axo/AxoDialog.dom.tsx';
import { SAFETY_NUMBER_VIEWER_DIALOG_BODY_MAX_HEIGHT } from './SafetyNumberViewer.dom.tsx';
import { tw } from '../axo/tw.dom.tsx';
import { AxoSymbol } from '../axo/AxoSymbol.dom.tsx';

enum DialogState {
  StartingInReview = 'StartingInReview',
  ExplicitReviewNeeded = 'ExplicitReviewNeeded',
  ExplicitReviewStep = 'ExplicitReviewStep',
  ExplicitReviewComplete = 'ExplicitReviewComplete',
}

export type SafetyNumberProps = {
  contactID: string;
  onClose: () => void;
};

type StoryContacts = {
  story?: {
    name: string;
    // For My Story or custom distribution lists, conversationId will be our own
    conversationId: string;
    // For Group stories, distributionId will not be provided
    distributionId?: StoryDistributionIdString;
  };
  contacts: Array<ConversationType>;
};
export type ContactsByStory = Array<StoryContacts>;

export type Props = Readonly<{
  confirmText?: string;
  contacts: ContactsByStory;
  getPreferredBadge: PreferredBadgeSelectorType;
  i18n: LocalizerType;
  onCancel: () => void;
  onConfirm: () => void;
  removeFromStory?: (
    distributionId: StoryDistributionIdString,
    serviceIds: Array<ServiceIdString>
  ) => unknown;
  renderSafetyNumber: (props: SafetyNumberProps) => JSX.Element;
  theme: ThemeType;
}>;

function doesRequireExplicitReviewMode(count: number) {
  return count > 5;
}

function getStartingDialogState(count: number): DialogState {
  if (count === 0) {
    return DialogState.ExplicitReviewComplete;
  }

  if (doesRequireExplicitReviewMode(count)) {
    return DialogState.ExplicitReviewNeeded;
  }

  return DialogState.StartingInReview;
}

export function SafetyNumberChangeDialog({
  confirmText,
  contacts,
  getPreferredBadge,
  i18n,
  onCancel,
  onConfirm,
  removeFromStory,
  renderSafetyNumber,
  theme,
}: Props): JSX.Element {
  const totalCount = contacts.reduce(
    (count, item) => count + item.contacts.length,
    0
  );
  const allVerified = contacts.every(item =>
    item.contacts.every(contact => contact.isVerified)
  );
  const [dialogState, setDialogState] = useState<DialogState>(
    getStartingDialogState(totalCount)
  );
  const [selectedContact, setSelectedContact] =
    useState<ConversationType | null>(null);

  useEffect(() => {
    if (
      dialogState === DialogState.ExplicitReviewStep &&
      (totalCount === 0 || allVerified)
    ) {
      // oxlint-disable-next-line react/set-state-in-effect
      setDialogState(DialogState.ExplicitReviewComplete);
    }
  }, [allVerified, dialogState, setDialogState, totalCount]);

  const onClearSelectedContact = useCallback(() => {
    setSelectedContact(null);
  }, []);

  if (selectedContact) {
    return (
      <AxoDialog.Root open onOpenChange={onClearSelectedContact}>
        <AxoDialog.Content size="md" escape="cancel-is-destructive">
          <AxoDialog.Header>
            <AxoDialog.Back onClick={onClearSelectedContact} />
            <AxoDialog.Title>
              {i18n('icu:SafetyNumberModal__title')}
            </AxoDialog.Title>
          </AxoDialog.Header>
          <AxoDialog.Body
            maxHeight={SAFETY_NUMBER_VIEWER_DIALOG_BODY_MAX_HEIGHT}
          >
            {renderSafetyNumber({
              contactID: selectedContact.id,
              onClose: onClearSelectedContact,
            })}
          </AxoDialog.Body>
        </AxoDialog.Content>
      </AxoDialog.Root>
    );
  }

  if (
    dialogState === DialogState.StartingInReview ||
    dialogState === DialogState.ExplicitReviewStep
  ) {
    let text: string;
    if (dialogState === DialogState.ExplicitReviewStep) {
      text = i18n('icu:safetyNumberChangeDialog_done');
    } else if (allVerified || totalCount === 0) {
      text = confirmText || i18n('icu:safetyNumberChangeDialog_send');
    } else {
      text = confirmText || i18n('icu:sendAnyway');
    }

    return (
      <AxoDialog.Root open onOpenChange={onCancel}>
        <AxoDialog.Content size="md" escape="cancel-is-destructive">
          <AxoDialog.Body>
            <div className={tw('mb-2.5 flex justify-center')}>
              <ShieldIcon />
            </div>
            <div className={tw('text-center')}>
              <AxoDialog.Title>
                <span className={tw('type-title-medium')}>
                  {i18n('icu:safetyNumberChanges')}
                </span>
              </AxoDialog.Title>
              <AxoDialog.Description>
                <p className={tw('mb-2.5')}>
                  {i18n('icu:safetyNumberChangeDialog__message')}
                </p>
              </AxoDialog.Description>
            </div>
            {contacts.map((section: StoryContacts) => (
              <ContactSection
                key={section.story?.name || 'default'}
                section={section}
                getPreferredBadge={getPreferredBadge}
                i18n={i18n}
                removeFromStory={removeFromStory}
                setSelectedContact={setSelectedContact}
                theme={theme}
              />
            ))}
          </AxoDialog.Body>
          <AxoDialog.Footer>
            <AxoDialog.Actions>
              <AxoDialog.Action
                variant="subtle-secondary"
                onClick={onCancel}
                autoFocus
              >
                {i18n('icu:cancel')}
              </AxoDialog.Action>
              <AxoDialog.Action
                variant="strong-primary"
                onClick={() => {
                  if (dialogState === DialogState.ExplicitReviewStep) {
                    setDialogState(DialogState.ExplicitReviewComplete);
                  } else {
                    onConfirm();
                  }
                }}
              >
                {text}
              </AxoDialog.Action>
            </AxoDialog.Actions>
          </AxoDialog.Footer>
        </AxoDialog.Content>
      </AxoDialog.Root>
    );
  }

  let text: string;
  if (dialogState === DialogState.ExplicitReviewNeeded) {
    text = confirmText || i18n('icu:sendAnyway');
  } else if (dialogState === DialogState.ExplicitReviewComplete) {
    text = confirmText || i18n('icu:safetyNumberChangeDialog_send');
  } else {
    throw missingCaseError(dialogState);
  }

  return (
    <AxoDialog.Root open onOpenChange={onCancel}>
      <AxoDialog.Content size="md" escape="cancel-is-destructive">
        <AxoDialog.Body>
          <div className={tw('mb-2.5 flex justify-center')}>
            <ShieldIcon />
          </div>
          <div className={tw('text-center')}>
            <AxoDialog.Title>
              <span className={tw('type-title-medium')}>
                {i18n('icu:safetyNumberChanges')}
              </span>
            </AxoDialog.Title>
            <AxoDialog.Description>
              <p>
                {dialogState === DialogState.ExplicitReviewNeeded
                  ? i18n('icu:safetyNumberChangeDialog__many-contacts', {
                      count: totalCount,
                    })
                  : i18n('icu:safetyNumberChangeDialog__post-review')}
              </p>
            </AxoDialog.Description>
          </div>
        </AxoDialog.Body>
        <AxoDialog.Footer>
          <AxoDialog.Actions>
            {dialogState !== DialogState.ExplicitReviewNeeded && (
              <AxoDialog.Action
                variant="subtle-secondary"
                onClick={onCancel}
                autoFocus
              >
                {i18n('icu:cancel')}
              </AxoDialog.Action>
            )}
            {dialogState === DialogState.ExplicitReviewNeeded && (
              <AxoDialog.Action
                variant="strong-primary"
                onClick={() => setDialogState(DialogState.ExplicitReviewStep)}
              >
                {i18n('icu:safetyNumberChangeDialog__review')}
              </AxoDialog.Action>
            )}
            <AxoDialog.Action variant="strong-primary" onClick={onConfirm}>
              {text}
            </AxoDialog.Action>
          </AxoDialog.Actions>
        </AxoDialog.Footer>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}

function ContactSection({
  section,
  getPreferredBadge,
  i18n,
  removeFromStory,
  setSelectedContact,
  theme,
}: Readonly<{
  section: StoryContacts;
  getPreferredBadge: PreferredBadgeSelectorType;
  i18n: LocalizerType;
  removeFromStory?: (
    distributionId: StoryDistributionIdString,
    serviceIds: Array<ServiceIdString>
  ) => unknown;
  setSelectedContact: (contact: ConversationType) => void;
  theme: ThemeType;
}>) {
  if (section.contacts.length === 0) {
    return null;
  }

  if (!section.story) {
    return (
      <ul className="module-SafetyNumberChangeDialog__contacts">
        {section.contacts.map((contact: ConversationType) => {
          const shouldShowNumber = Boolean(contact.name || contact.profileName);

          return (
            <ContactRow
              key={contact.id}
              contact={contact}
              getPreferredBadge={getPreferredBadge}
              i18n={i18n}
              removeFromStory={removeFromStory}
              setSelectedContact={setSelectedContact}
              shouldShowNumber={shouldShowNumber}
              theme={theme}
            />
          );
        })}
      </ul>
    );
  }

  const { distributionId } = section.story;
  const serviceIds = section.contacts
    .map(contact => contact.serviceId)
    .filter(isNotNil);
  const sectionName =
    distributionId === MY_STORY_ID
      ? i18n('icu:Stories__mine')
      : section.story.name;

  return (
    <div>
      <div className="module-SafetyNumberChangeDialog__row">
        <div className="module-SafetyNumberChangeDialog__row__story-name">
          {sectionName}
        </div>
        {distributionId && removeFromStory && serviceIds.length > 1 && (
          <SectionButtonWithMenu
            ariaLabel={i18n('icu:safetyNumberChangeDialog__actions-story', {
              story: sectionName,
            })}
            i18n={i18n}
            memberCount={serviceIds.length}
            storyName={sectionName}
            theme={theme}
            removeFromStory={() => {
              removeFromStory(distributionId, serviceIds);
            }}
          />
        )}
      </div>
      <ul className="module-SafetyNumberChangeDialog__contacts">
        {section.contacts.map((contact: ConversationType) => {
          const shouldShowNumber = Boolean(contact.name || contact.profileName);

          return (
            <ContactRow
              key={contact.id}
              contact={contact}
              distributionId={distributionId}
              getPreferredBadge={getPreferredBadge}
              i18n={i18n}
              removeFromStory={removeFromStory}
              setSelectedContact={setSelectedContact}
              shouldShowNumber={shouldShowNumber}
              theme={theme}
            />
          );
        })}
      </ul>
    </div>
  );
}

function SectionButtonWithMenu({
  ariaLabel,
  i18n,
  removeFromStory,
  storyName,
  memberCount,
  theme,
}: Readonly<{
  ariaLabel: string;
  i18n: LocalizerType;
  removeFromStory: () => unknown;
  storyName: string;
  memberCount: number;
  theme: ThemeType;
}>) {
  const [isConfirming, setIsConfirming] = useState<boolean>(false);

  return (
    <>
      <ContextMenu
        ariaLabel={ariaLabel}
        i18n={i18n}
        menuOptions={[
          {
            iconClassName: 'module-SafetyNumberChangeDialog__menu-icon--delete',
            label: i18n('icu:safetyNumberChangeDialog__remove-all'),
            onClick: () => setIsConfirming(true),
          },
        ]}
        className="module-SafetyNumberChangeDialog__row__chevron"
        popperClassName="module-SafetyNumberChangeDialog__row__chevron__popper"
        theme={theme === ThemeType.dark ? Theme.Dark : Theme.Light}
      />
      <AxoConfirmDialog.Root
        open={isConfirming}
        onOpenChange={setIsConfirming}
        // @ts-expect-error ConfirmationDialog migration: Needs title
        title={null}
        description={i18n('icu:safetyNumberChangeDialog__confirm-remove-all', {
          story: storyName,
          count: memberCount,
        })}
      >
        <AxoConfirmDialog.Cancel />
        <AxoConfirmDialog.Action
          variant="strong-destructive"
          onClick={() => {
            removeFromStory();
            setIsConfirming(false);
          }}
        >
          {i18n('icu:safetyNumberChangeDialog__remove-all')}
        </AxoConfirmDialog.Action>
      </AxoConfirmDialog.Root>
    </>
  );
}

function ContactRow({
  contact,
  distributionId,
  getPreferredBadge,
  i18n,
  removeFromStory,
  setSelectedContact,
  shouldShowNumber,
  theme,
}: Readonly<{
  contact: ConversationType;
  distributionId?: StoryDistributionIdString;
  getPreferredBadge: PreferredBadgeSelectorType;
  i18n: LocalizerType;
  removeFromStory?: (
    distributionId: StoryDistributionIdString,
    serviceIds: Array<ServiceIdString>
  ) => unknown;
  setSelectedContact: (contact: ConversationType) => void;
  shouldShowNumber: boolean;
  theme: ThemeType;
}>) {
  const { serviceId } = contact;

  return (
    <li className="module-SafetyNumberChangeDialog__row" key={contact.id}>
      <Avatar
        avatarPlaceholderGradient={contact.avatarPlaceholderGradient}
        avatarUrl={contact.avatarUrl}
        badge={getPreferredBadge(contact.badges)}
        color={contact.color}
        conversationType="direct"
        hasAvatar={contact.hasAvatar}
        i18n={i18n}
        phoneNumber={contact.phoneNumber}
        profileName={contact.profileName}
        theme={theme}
        title={contact.title}
        size={AvatarSize.THIRTY_TWO}
      />
      <div className="module-SafetyNumberChangeDialog__row--wrapper">
        <div className="module-SafetyNumberChangeDialog__row--name">
          <UserText text={contact.title} />
          {isInSystemContacts(contact) && (
            <span>
              {' '}
              <InContactsIcon i18n={i18n} />
            </span>
          )}
        </div>
        {shouldShowNumber || contact.isVerified ? (
          <div className="module-SafetyNumberChangeDialog__row--subtitle">
            {shouldShowNumber && (
              <span className="module-SafetyNumberChangeDialog__rtl-span">
                {contact.phoneNumber}
              </span>
            )}
            {shouldShowNumber && contact.isVerified && (
              <span className="module-SafetyNumberChangeDialog__rtl-span">
                &nbsp;&middot;&nbsp;
              </span>
            )}
            {contact.isVerified && (
              <span className="module-SafetyNumberChangeDialog__rtl-span">
                {i18n('icu:verified')}
              </span>
            )}
          </div>
        ) : null}
      </div>
      {distributionId && removeFromStory && serviceId ? (
        <RowButtonWithMenu
          ariaLabel={i18n('icu:safetyNumberChangeDialog__actions-contact', {
            contact: contact.title,
          })}
          i18n={i18n}
          theme={theme}
          removeFromStory={() => removeFromStory(distributionId, [serviceId])}
          verifyContact={() => setSelectedContact(contact)}
        />
      ) : (
        <button
          className="module-SafetyNumberChangeDialog__row__view"
          onClick={() => {
            setSelectedContact(contact);
          }}
          tabIndex={0}
          type="button"
        >
          {i18n('icu:view')}
        </button>
      )}
    </li>
  );
}

function RowButtonWithMenu({
  ariaLabel,
  i18n,
  removeFromStory,
  verifyContact,
  theme,
}: Readonly<{
  ariaLabel: string;
  i18n: LocalizerType;
  removeFromStory: () => unknown;
  verifyContact: () => unknown;
  theme: ThemeType;
}>) {
  return (
    <ContextMenu
      ariaLabel={ariaLabel}
      i18n={i18n}
      menuOptions={[
        {
          iconClassName: 'module-SafetyNumberChangeDialog__menu-icon--verify',
          label: i18n('icu:safetyNumberChangeDialog__verify-number'),
          onClick: verifyContact,
        },
        {
          iconClassName: 'module-SafetyNumberChangeDialog__menu-icon--delete',
          label: i18n('icu:safetyNumberChangeDialog__remove'),
          onClick: removeFromStory,
        },
      ]}
      className="module-SafetyNumberChangeDialog__row__chevron"
      popperClassName="module-SafetyNumberChangeDialog__row__chevron__popper"
      theme={theme === ThemeType.dark ? Theme.Dark : Theme.Light}
    />
  );
}

function ShieldIcon() {
  return (
    <div
      className={tw('size-fit rounded-full p-3', 'bg-accent-tint text-accent')}
    >
      <AxoSymbol.Icon label={null} size={24} symbol="shield-check" />
    </div>
  );
}
