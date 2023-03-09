// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import classNames from 'classnames';

import type { LocalizerType } from '../types/Util';
import type { UsernameReservationType } from '../types/Username';
import { missingCaseError } from '../util/missingCaseError';
import { getNickname, getDiscriminator } from '../types/Username';
import {
  UsernameReservationState,
  UsernameReservationError,
} from '../state/ducks/usernameEnums';

import { ConfirmationDialog } from './ConfirmationDialog';
import { Input } from './Input';
import { Spinner } from './Spinner';
import { Modal } from './Modal';
import { Button, ButtonVariant } from './Button';

export type PropsDataType = Readonly<{
  i18n: LocalizerType;
  currentUsername?: string;
  reservation?: UsernameReservationType;
  error?: UsernameReservationError;
  state: UsernameReservationState;
  minNickname: number;
  maxNickname: number;
}>;

export type ActionPropsDataType = Readonly<{
  setUsernameReservationError(
    error: UsernameReservationError | undefined
  ): void;
  reserveUsername(nickname: string | undefined): void;
  confirmUsername(): void;
}>;

export type ExternalPropsDataType = Readonly<{
  onClose(): void;
}>;

export type PropsType = PropsDataType &
  ActionPropsDataType &
  ExternalPropsDataType;

export function EditUsernameModalBody({
  i18n,
  currentUsername,
  reserveUsername,
  confirmUsername,
  minNickname,
  maxNickname,
  reservation,
  setUsernameReservationError,
  error,
  state,
  onClose,
}: PropsType): JSX.Element {
  const currentNickname = useMemo(() => {
    if (!currentUsername) {
      return undefined;
    }

    return getNickname(currentUsername);
  }, [currentUsername]);

  const isReserving = state === UsernameReservationState.Reserving;
  const isConfirming = state === UsernameReservationState.Confirming;
  const canSave = !isReserving && !isConfirming && reservation !== undefined;

  const [hasEverChanged, setHasEverChanged] = useState(false);
  const [nickname, setNickname] = useState(currentNickname);
  const [isLearnMoreVisible, setIsLearnMoreVisible] = useState(false);

  useEffect(() => {
    if (state === UsernameReservationState.Closed) {
      onClose();
    }
  }, [state, onClose]);

  const discriminator = useMemo(() => {
    if (reservation !== undefined) {
      // New discriminator
      return getDiscriminator(reservation.username);
    }

    // User never changed the nickname - return discriminator from the current
    // username.
    if (!hasEverChanged && currentUsername) {
      return getDiscriminator(currentUsername);
    }

    // No reservation, different nickname - no discriminator
    return undefined;
  }, [reservation, hasEverChanged, currentUsername]);

  const errorString = useMemo(() => {
    if (!error) {
      return undefined;
    }
    if (error === UsernameReservationError.NotEnoughCharacters) {
      return i18n('ProfileEditor--username--check-character-min', {
        min: minNickname,
      });
    }
    if (error === UsernameReservationError.TooManyCharacters) {
      return i18n('ProfileEditor--username--check-character-max', {
        max: maxNickname,
      });
    }
    if (error === UsernameReservationError.CheckStartingCharacter) {
      return i18n('ProfileEditor--username--check-starting-character');
    }
    if (error === UsernameReservationError.CheckCharacters) {
      return i18n('ProfileEditor--username--check-characters');
    }
    if (error === UsernameReservationError.UsernameNotAvailable) {
      return i18n('ProfileEditor--username--unavailable');
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
    if (!hasEverChanged) {
      return;
    }

    reserveUsername(nickname);
  }, [hasEverChanged, nickname, reserveUsername]);

  const onChange = useCallback((newNickname: string) => {
    setHasEverChanged(true);
    setNickname(newNickname);
  }, []);

  const onSave = useCallback(() => {
    confirmUsername();
  }, [confirmUsername]);

  const onCancel = useCallback(() => {
    onClose();
  }, [onClose]);

  const onLearnMore = useCallback((e: React.MouseEvent) => {
    e.preventDefault();

    setIsLearnMoreVisible(true);
  }, []);

  let title = i18n('ProfileEditor--username--title');
  if (nickname && discriminator) {
    title = `${nickname}${discriminator}`;
  }

  const learnMoreTitle = (
    <>
      <i className="EditUsernameModalBody__learn-more__hashtag" />
      {i18n('EditUsernameModalBody__learn-more__title')}
    </>
  );

  return (
    <>
      <div className="EditUsernameModalBody__header">
        <div className="EditUsernameModalBody__header__large-at" />

        <div className="EditUsernameModalBody__header__preview">{title}</div>
      </div>

      <Input
        moduleClassName="Edit"
        i18n={i18n}
        disableSpellcheck
        disabled={isConfirming}
        onChange={onChange}
        onEnter={onSave}
        placeholder={i18n('EditUsernameModalBody__username-placeholder')}
        value={nickname}
      >
        {isReserving && <Spinner size="16px" svgSize="small" />}
        {discriminator && (
          <>
            <div className="EditUsernameModalBody__divider" />
            <div className="EditUsernameModalBody__discriminator">
              {discriminator}
            </div>
          </>
        )}
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
        {i18n('EditUsernameModalBody__username-helper')}
        &nbsp;
        <button
          type="button"
          className="EditUsernameModalBody__learn-more-button"
          onClick={onLearnMore}
        >
          {i18n('EditUsernameModalBody__learn-more')}
        </button>
      </div>

      <Modal.ButtonFooter>
        <Button
          disabled={isConfirming}
          onClick={onCancel}
          variant={ButtonVariant.Secondary}
        >
          {i18n('cancel')}
        </Button>
        <Button disabled={!canSave} onClick={onSave}>
          {isConfirming ? (
            <Spinner size="20px" svgSize="small" direction="on-avatar" />
          ) : (
            i18n('save')
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
          {i18n('EditUsernameModalBody__learn-more__body')}

          <Modal.ButtonFooter>
            <Button
              onClick={() => setIsLearnMoreVisible(false)}
              variant={ButtonVariant.Secondary}
            >
              {i18n('ok')}
            </Button>
          </Modal.ButtonFooter>
        </Modal>
      )}

      {error === UsernameReservationError.General && (
        <ConfirmationDialog
          dialogName="EditUsernameModalBody.generalError"
          cancelText={i18n('ok')}
          cancelButtonVariant={ButtonVariant.Secondary}
          i18n={i18n}
          onClose={() => setUsernameReservationError(undefined)}
        >
          {i18n('ProfileEditor--username--general-error')}
        </ConfirmationDialog>
      )}

      {error === UsernameReservationError.ConflictOrGone && (
        <ConfirmationDialog
          dialogName="EditUsernameModalBody.conflictOrGone"
          cancelText={i18n('ok')}
          cancelButtonVariant={ButtonVariant.Secondary}
          i18n={i18n}
          onClose={() => {
            if (nickname) {
              reserveUsername(nickname);
            }
          }}
        >
          {i18n('icu:ProfileEditor--username--reservation-gone', {
            username: reservation?.username ?? nickname,
          })}
        </ConfirmationDialog>
      )}
    </>
  );
}
