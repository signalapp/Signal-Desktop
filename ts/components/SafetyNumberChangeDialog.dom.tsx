// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useState, createRef, useEffect, type JSX } from 'react';
import { Avatar, AvatarSize } from './Avatar.dom.tsx';
import { InContactsIcon } from './InContactsIcon.dom.tsx';
import { Modal } from './Modal.dom.tsx';
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
import { AxoAlertDialog } from '../axo/AxoAlertDialog.dom.tsx';

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
  const [selectedContact, setSelectedContact] = useState<
    ConversationType | undefined
  >(undefined);
  const cancelButtonRef = createRef<HTMLButtonElement>();

  useEffect(() => {
    if (cancelButtonRef && cancelButtonRef.current) {
      cancelButtonRef.current.focus();
    }
  }, [cancelButtonRef, contacts]);

  useEffect(() => {
    if (
      dialogState === DialogState.ExplicitReviewStep &&
      (totalCount === 0 || allVerified)
    ) {
      setDialogState(DialogState.ExplicitReviewComplete);
    }
  }, [allVerified, dialogState, setDialogState, totalCount]);

  const onClose = selectedContact
    ? () => {
        setSelectedContact(undefined);
      }
    : onCancel;

  if (selectedContact) {
    return (
      <Modal
        modalName="SafetyNumberChangeDialog"
        hasXButton
        i18n={i18n}
        onClose={onClose}
      >
        {renderSafetyNumber({ contactID: selectedContact.id, onClose })}
      </Modal>
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
      <AxoAlertDialog.Root open onOpenChange={onClose}>
        <AxoAlertDialog.Content escape="cancel-is-destructive">
          <AxoAlertDialog.Body>
            <div className="module-SafetyNumberChangeDialog__shield-icon" />
            <AxoAlertDialog.Title>
              {i18n('icu:safetyNumberChanges')}
            </AxoAlertDialog.Title>
            <AxoAlertDialog.Description>
              {i18n('icu:safetyNumberChangeDialog__message')}
            </AxoAlertDialog.Description>
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
          </AxoAlertDialog.Body>
          <AxoAlertDialog.Footer>
            <AxoAlertDialog.Cancel />
            <AxoAlertDialog.Action
              variant="primary"
              onClick={() => {
                if (dialogState === DialogState.ExplicitReviewStep) {
                  setDialogState(DialogState.ExplicitReviewComplete);
                } else {
                  onConfirm();
                }
              }}
            >
              {text}
            </AxoAlertDialog.Action>
          </AxoAlertDialog.Footer>
        </AxoAlertDialog.Content>
      </AxoAlertDialog.Root>
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
    <AxoAlertDialog.Root open onOpenChange={onClose}>
      <AxoAlertDialog.Content
        escape={
          dialogState === DialogState.ExplicitReviewNeeded
            ? 'cancel-is-destructive'
            : 'cancel-is-noop'
        }
      >
        <AxoAlertDialog.Body>
          <div className="module-SafetyNumberChangeDialog__shield-icon" />
          <AxoAlertDialog.Title>
            {i18n('icu:safetyNumberChanges')}
          </AxoAlertDialog.Title>
          <AxoAlertDialog.Description>
            {dialogState === DialogState.ExplicitReviewNeeded
              ? i18n('icu:safetyNumberChangeDialog__many-contacts', {
                  count: totalCount,
                })
              : i18n('icu:safetyNumberChangeDialog__post-review')}
          </AxoAlertDialog.Description>
        </AxoAlertDialog.Body>
        <AxoAlertDialog.Footer>
          {dialogState !== DialogState.ExplicitReviewNeeded && (
            <AxoAlertDialog.Cancel />
          )}
          {dialogState === DialogState.ExplicitReviewNeeded && (
            <AxoAlertDialog.Action
              variant="primary"
              onClick={() => setDialogState(DialogState.ExplicitReviewStep)}
            >
              {i18n('icu:safetyNumberChangeDialog__review')}
            </AxoAlertDialog.Action>
          )}
          <AxoAlertDialog.Action variant="primary" onClick={onConfirm}>
            {text}
          </AxoAlertDialog.Action>
        </AxoAlertDialog.Footer>
      </AxoAlertDialog.Content>
    </AxoAlertDialog.Root>
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
    <div className="module-SafetyNumberChangeDialog__section">
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
            icon: 'module-SafetyNumberChangeDialog__menu-icon--delete',
            label: i18n('icu:safetyNumberChangeDialog__remove-all'),
            onClick: () => setIsConfirming(true),
          },
        ]}
        moduleClassName="module-SafetyNumberChangeDialog__row__chevron"
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
          variant="destructive"
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
          icon: 'module-SafetyNumberChangeDialog__menu-icon--verify',
          label: i18n('icu:safetyNumberChangeDialog__verify-number'),
          onClick: verifyContact,
        },
        {
          icon: 'module-SafetyNumberChangeDialog__menu-icon--delete',
          label: i18n('icu:safetyNumberChangeDialog__remove'),
          onClick: removeFromStory,
        },
      ]}
      moduleClassName="module-SafetyNumberChangeDialog__row__chevron"
      theme={theme === ThemeType.dark ? Theme.Dark : Theme.Light}
    />
  );
}
