// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import classNames from 'classnames';

import type { LocalizerType } from '../types/Util';
import type { UsernameReservationType } from '../types/Username';
import { ToastType } from '../types/Toast';
import { missingCaseError } from '../util/missingCaseError';
import { getNickname, getDiscriminator, isCaseChange } from '../types/Username';
import {
  UsernameReservationState,
  UsernameReservationError,
} from '../state/ducks/usernameEnums';
import type { ReserveUsernameOptionsType } from '../state/ducks/username';
import type { ShowToastAction } from '../state/ducks/toast';

import { AutoSizeInput } from './AutoSizeInput';
import { ConfirmationDialog } from './ConfirmationDialog';
import { Input } from './Input';
import { Spinner } from './Spinner';
import { Modal } from './Modal';
import { Button, ButtonVariant } from './Button';

export type PropsDataType = Readonly<{
  i18n: LocalizerType;
  currentUsername?: string;
  usernameCorrupted: boolean;
  reservation?: UsernameReservationType;
  error?: UsernameReservationError;
  state: UsernameReservationState;
  recoveredUsername: string | undefined;
  minNickname: number;
  maxNickname: number;
}>;

export type ActionPropsDataType = Readonly<{
  setUsernameReservationError(
    error: UsernameReservationError | undefined
  ): void;
  clearUsernameReservation(): void;
  reserveUsername(optiona: ReserveUsernameOptionsType): void;
  confirmUsername(): void;
  showToast: ShowToastAction;
}>;

export type ExternalPropsDataType = Readonly<{
  onClose(): void;
  isRootModal: boolean;
}>;

export type PropsType = PropsDataType &
  ActionPropsDataType &
  ExternalPropsDataType;

enum UpdateState {
  Original = 'Original',
  Nickname = 'Nickname',
  Discriminator = 'Discriminator',
}

const DISCRIMINATOR_MAX_LENGTH = 9;

export function EditUsernameModalBody({
  i18n,
  currentUsername,
  usernameCorrupted,
  reserveUsername,
  confirmUsername,
  showToast,
  minNickname,
  maxNickname,
  reservation,
  setUsernameReservationError,
  clearUsernameReservation,
  error,
  state,
  recoveredUsername,
  isRootModal,
  onClose,
}: PropsType): JSX.Element {
  const currentNickname = useMemo(() => {
    if (!currentUsername) {
      return undefined;
    }

    return getNickname(currentUsername);
  }, [currentUsername]);

  const currentDiscriminator =
    currentUsername === undefined
      ? undefined
      : getDiscriminator(currentUsername);

  const [updateState, setUpdateState] = useState(UpdateState.Original);
  const [nickname, setNickname] = useState(currentNickname);
  const [isLearnMoreVisible, setIsLearnMoreVisible] = useState(false);
  const [isConfirmingSave, setIsConfirmingSave] = useState(false);
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);

  const [customDiscriminator, setCustomDiscriminator] = useState<
    string | undefined
  >(undefined);

  const discriminator = useMemo(() => {
    // Always give preference to user-selected custom discriminator.
    if (
      customDiscriminator !== undefined ||
      updateState === UpdateState.Discriminator
    ) {
      return customDiscriminator;
    }

    if (reservation !== undefined) {
      // New discriminator from reservation
      return getDiscriminator(reservation.username);
    }

    return currentDiscriminator;
  }, [reservation, updateState, currentDiscriminator, customDiscriminator]);

  // Disallow non-numeric discriminator
  const updateCustomDiscriminator = useCallback((newValue: string): void => {
    const digits = newValue.replace(/[^\d]+/g, '');
    setUpdateState(UpdateState.Discriminator);
    setCustomDiscriminator(digits);
  }, []);

  // When we change nickname with previously erased discriminator - reset the
  // discriminator state.
  useEffect(() => {
    if (customDiscriminator !== '' || !reservation) {
      return;
    }
    setCustomDiscriminator(undefined);
  }, [customDiscriminator, reservation]);

  // Clear reservation if user erases the nickname
  useEffect(() => {
    if (updateState === UpdateState.Nickname && !nickname) {
      clearUsernameReservation();
    }
  }, [clearUsernameReservation, nickname, updateState]);

  const isReserving = state === UsernameReservationState.Reserving;
  const isConfirming = state === UsernameReservationState.Confirming;
  const canSave =
    !isReserving &&
    !isConfirming &&
    (reservation !== undefined || customDiscriminator);
  const isDiscriminatorVisible =
    Boolean(nickname || customDiscriminator) &&
    (discriminator || updateState === UpdateState.Discriminator);

  useEffect(() => {
    if (state === UsernameReservationState.Closed) {
      onClose();
    }
  }, [state, onClose]);

  useEffect(() => {
    if (
      state === UsernameReservationState.Closed &&
      recoveredUsername &&
      isRootModal
    ) {
      showToast({
        toastType: ToastType.UsernameRecovered,
        parameters: {
          username: recoveredUsername,
        },
      });
    }
  }, [state, recoveredUsername, showToast, isRootModal]);

  const errorString = useMemo(() => {
    if (!error) {
      return undefined;
    }
    if (error === UsernameReservationError.NotEnoughCharacters) {
      return i18n('icu:ProfileEditor--username--check-character-min-plural', {
        min: minNickname,
      });
    }
    if (error === UsernameReservationError.TooManyCharacters) {
      return i18n('icu:ProfileEditor--username--check-character-max-plural', {
        max: maxNickname,
      });
    }
    if (error === UsernameReservationError.CheckStartingCharacter) {
      return i18n('icu:ProfileEditor--username--check-starting-character');
    }
    if (error === UsernameReservationError.CheckCharacters) {
      return i18n('icu:ProfileEditor--username--check-characters');
    }
    if (error === UsernameReservationError.UsernameNotAvailable) {
      return i18n('icu:ProfileEditor--username--unavailable');
    }
    if (error === UsernameReservationError.NotEnoughDiscriminator) {
      return i18n('icu:ProfileEditor--username--check-discriminator-min');
    }
    if (error === UsernameReservationError.AllZeroDiscriminator) {
      return i18n('icu:ProfileEditor--username--check-discriminator-all-zero');
    }
    if (error === UsernameReservationError.LeadingZeroDiscriminator) {
      return i18n(
        'icu:ProfileEditor--username--check-discriminator-leading-zero'
      );
    }
    if (error === UsernameReservationError.TooManyAttempts) {
      return i18n('icu:ProfileEditor--username--too-many-attempts');
    }
    // Displayed through confirmation modal below
    if (
      error === UsernameReservationError.General ||
      error === UsernameReservationError.ConflictOrGone
    ) {
      return;
    }
    throw missingCaseError(error);
  }, [error, i18n, minNickname, maxNickname]);

  useEffect(() => {
    // Initial effect run
    if (updateState === UpdateState.Original) {
      return;
    }

    // Sanity-check, we should never get here.
    if (!nickname) {
      return;
    }

    // User just erased discriminator
    if (updateState === UpdateState.Discriminator && !customDiscriminator) {
      return;
    }

    if (isConfirming) {
      return;
    }

    reserveUsername({ nickname, customDiscriminator });
  }, [
    updateState,
    nickname,
    reserveUsername,
    isConfirming,
    customDiscriminator,
  ]);

  const onChange = useCallback((newNickname: string) => {
    setUpdateState(UpdateState.Nickname);
    setNickname(newNickname);
  }, []);

  const onSave = useCallback(() => {
    if (usernameCorrupted) {
      setIsConfirmingReset(true);
    } else if (!currentUsername || (reservation && isCaseChange(reservation))) {
      confirmUsername();
    } else {
      setIsConfirmingSave(true);
    }
  }, [confirmUsername, currentUsername, reservation, usernameCorrupted]);

  const onCancelSave = useCallback(() => {
    setIsConfirmingReset(false);
    setIsConfirmingSave(false);
  }, []);

  const onConfirmUsername = useCallback(() => {
    confirmUsername();
  }, [confirmUsername]);

  const onCancel = useCallback(() => {
    onClose();
  }, [onClose]);

  const onLearnMore = useCallback((e: React.MouseEvent) => {
    e.preventDefault();

    setIsLearnMoreVisible(true);
  }, []);

  let title = i18n('icu:ProfileEditor--username--title');
  if (nickname && discriminator) {
    title = `${nickname}.${discriminator}`;
  }

  const learnMoreTitle = (
    <>
      <i className="EditUsernameModalBody__learn-more__hashtag" />
      {i18n('icu:EditUsernameModalBody__learn-more__title')}
    </>
  );

  return (
    <>
      <div className="EditUsernameModalBody__header">
        <div className="EditUsernameModalBody__header__large-at" />

        <div className="EditUsernameModalBody__header__preview">{title}</div>
      </div>

      <Input
        moduleClassName="EditUsernameModalBody__input"
        i18n={i18n}
        disableSpellcheck
        disabled={isConfirming}
        onChange={onChange}
        onEnter={onSave}
        placeholder={i18n('icu:EditUsernameModalBody__username-placeholder')}
        value={nickname}
      >
        {isReserving && <Spinner size="16px" svgSize="small" />}
        {isDiscriminatorVisible ? (
          <>
            <div className="EditUsernameModalBody__divider" />
            <AutoSizeInput
              moduleClassName="EditUsernameModalBody__discriminator"
              disableSpellcheck
              disabled={isConfirming}
              value={discriminator}
              onChange={updateCustomDiscriminator}
              placeholder="00"
              maxLength={DISCRIMINATOR_MAX_LENGTH}
            />
          </>
        ) : null}
      </Input>

      {errorString && (
        <div className="EditUsernameModalBody__error">{errorString}</div>
      )}
      <div
        className={classNames(
          'EditUsernameModalBody__info',
          !errorString ? 'EditUsernameModalBody__info--no-error' : undefined
        )}
      >
        {i18n('icu:EditUsernameModalBody__username-helper')}
        &nbsp;
        <button
          type="button"
          className="EditUsernameModalBody__learn-more-button"
          onClick={onLearnMore}
        >
          {i18n('icu:EditUsernameModalBody__learn-more')}
        </button>
      </div>

      <Modal.ButtonFooter>
        <Button
          disabled={isConfirming}
          onClick={onCancel}
          variant={ButtonVariant.Secondary}
        >
          {i18n('icu:cancel')}
        </Button>
        <Button disabled={!canSave} onClick={onSave}>
          {isConfirming ? (
            <Spinner size="20px" svgSize="small" direction="on-avatar" />
          ) : (
            i18n('icu:save')
          )}
        </Button>
      </Modal.ButtonFooter>

      {isLearnMoreVisible && (
        <Modal
          modalName="EditUsernamModalBody.LearnMore"
          moduleClassName="EditUsernameModalBody__learn-more"
          i18n={i18n}
          onClose={() => setIsLearnMoreVisible(false)}
          title={learnMoreTitle}
        >
          {i18n('icu:EditUsernameModalBody__learn-more__body')}

          <Modal.ButtonFooter>
            <Button
              onClick={() => setIsLearnMoreVisible(false)}
              variant={ButtonVariant.Secondary}
            >
              {i18n('icu:ok')}
            </Button>
          </Modal.ButtonFooter>
        </Modal>
      )}

      {error === UsernameReservationError.General && (
        <ConfirmationDialog
          dialogName="EditUsernameModalBody.generalError"
          cancelText={i18n('icu:ok')}
          cancelButtonVariant={ButtonVariant.Secondary}
          i18n={i18n}
          onClose={() => setUsernameReservationError(undefined)}
        >
          {i18n('icu:ProfileEditor--username--general-error')}
        </ConfirmationDialog>
      )}

      {error === UsernameReservationError.ConflictOrGone && (
        <ConfirmationDialog
          dialogName="EditUsernameModalBody.conflictOrGone"
          cancelText={i18n('icu:ok')}
          cancelButtonVariant={ButtonVariant.Secondary}
          i18n={i18n}
          onClose={() => {
            if (nickname) {
              reserveUsername({ nickname, customDiscriminator });
            }
          }}
        >
          {i18n('icu:ProfileEditor--username--reservation-gone', {
            username: reservation?.username ?? nickname ?? '',
          })}
        </ConfirmationDialog>
      )}

      {isConfirmingSave && (
        <ConfirmationDialog
          dialogName="EditUsernameModalBody.confirmChange"
          cancelText={i18n('icu:cancel')}
          actions={[
            {
              action: onConfirmUsername,
              style: 'negative',
              text: i18n(
                'icu:EditUsernameModalBody__change-confirmation__continue'
              ),
            },
          ]}
          i18n={i18n}
          onClose={onCancelSave}
        >
          {i18n('icu:EditUsernameModalBody__change-confirmation')}
        </ConfirmationDialog>
      )}

      {isConfirmingReset && (
        <ConfirmationDialog
          dialogName="EditUsernameModalBody.confirmReset"
          cancelText={i18n('icu:cancel')}
          actions={[
            {
              action: onConfirmUsername,
              style: 'negative',
              text: i18n(
                'icu:EditUsernameModalBody__change-confirmation__continue'
              ),
            },
          ]}
          i18n={i18n}
          onClose={onCancelSave}
        >
          {i18n('icu:EditUsernameModalBody__recover-confirmation')}
        </ConfirmationDialog>
      )}
    </>
  );
}
