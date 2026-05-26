// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
  type JSX,
  type MouseEvent,
} from 'react';
import classNames from 'classnames';
import lodash from 'lodash';

import type { LocalizerType } from '../types/Util.std.ts';
import type { UsernameReservationType } from '../types/Username.std.ts';
import { ToastType } from '../types/Toast.dom.tsx';
import { missingCaseError } from '../util/missingCaseError.std.ts';
import {
  getNickname,
  getDiscriminator,
  isCaseChange,
} from '../types/Username.std.ts';
import {
  UsernameReservationState,
  UsernameReservationError,
} from '../state/ducks/usernameEnums.std.ts';
import type { ReserveUsernameOptionsType } from '../state/ducks/username.preload.ts';
import type { ShowToastAction } from '../state/ducks/toast.preload.ts';
import { AutoSizeInput } from './AutoSizeInput.dom.tsx';
import { Input } from './Input.dom.tsx';
import { Spinner } from './Spinner.dom.tsx';
import { useConfirmDiscard } from '../hooks/useConfirmDiscard.dom.tsx';
import { AxoButton } from '../axo/AxoButton.dom.tsx';
import { AxoConfirmDialog } from '../axo/AxoConfirmDialog.dom.tsx';
import { AxoAlertDialog } from '../axo/AxoAlertDialog.dom.tsx';
import { AxoSymbol } from '../axo/AxoSymbol.dom.tsx';

const { noop } = lodash;

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
  setUsernameReservationError: (
    error: UsernameReservationError | undefined
  ) => void;
  clearUsernameReservation: () => void;
  reserveUsername: (optiona: ReserveUsernameOptionsType) => void;
  confirmUsername: () => void;
  showToast: ShowToastAction;
}>;

export type ExternalPropsDataType = Readonly<{
  onClose: () => void;
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

export function UsernameEditor({
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
      setTimeout(() => onClose(), 500);
    }
  }, [state, onClose]);

  useEffect(() => {
    if (state === UsernameReservationState.Closed && recoveredUsername) {
      showToast({
        toastType: ToastType.UsernameRecovered,
        parameters: {
          username: recoveredUsername,
        },
      });
    }
  }, [state, recoveredUsername, showToast]);

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

  const onLearnMore = useCallback((e: MouseEvent) => {
    e.preventDefault();

    setIsLearnMoreVisible(true);
  }, []);

  const tryClose = useRef<(() => void) | null>(null);
  const [confirmDiscardModal, confirmDiscardIf] = useConfirmDiscard({
    i18n,
    name: 'UsernameEditor',
    tryClose,
    // @ts-expect-error ConfirmationDialog migration: Needs title
    title: null,
    // @ts-expect-error ConfirmationDialog migration: Needs description
    description: null,
  });

  const onTryClose = useCallback(() => {
    const onDiscard = noop;
    confirmDiscardIf(
      Boolean(
        currentNickname !== nickname ||
        (customDiscriminator && customDiscriminator !== currentDiscriminator)
      ),
      onDiscard
    );
  }, [
    confirmDiscardIf,
    currentDiscriminator,
    currentNickname,
    customDiscriminator,
    nickname,
  ]);
  tryClose.current = onTryClose;

  let title = i18n('icu:ProfileEditor--username--title');
  if (nickname && discriminator) {
    title = `${nickname}.${discriminator}`;
  }

  return (
    <>
      <div className="UsernameEditor__header">
        <div className="UsernameEditor__header__large-at" />

        <div className="UsernameEditor__header__preview">{title}</div>
      </div>
      <Input
        moduleClassName="UsernameEditor__input"
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
            <div className="UsernameEditor__divider" />
            <AutoSizeInput
              moduleClassName="UsernameEditor__discriminator"
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
        <div className="UsernameEditor__error">{errorString}</div>
      )}
      <div
        className={classNames(
          'UsernameEditor__info',
          !errorString ? 'UsernameEditor__info--no-error' : undefined
        )}
      >
        {i18n('icu:EditUsernameModalBody__username-helper')}
        &nbsp;
        <button
          type="button"
          className="UsernameEditor__learn-more-button"
          onClick={onLearnMore}
        >
          {i18n('icu:EditUsernameModalBody__learn-more')}
        </button>
      </div>
      <div className="UsernameEditor__button-footer">
        <AxoButton.Root
          variant="secondary"
          size="lg"
          disabled={isConfirming}
          onClick={onCancel}
        >
          {i18n('icu:cancel')}
        </AxoButton.Root>
        <AxoButton.Root
          variant="primary"
          size="lg"
          disabled={!canSave}
          onClick={onSave}
          pending={isConfirming}
        >
          {i18n('icu:save')}
        </AxoButton.Root>
      </div>

      {confirmDiscardModal}

      <AxoConfirmDialog.Root
        open={isLearnMoreVisible}
        onOpenChange={setIsLearnMoreVisible}
        title={
          <>
            <AxoSymbol.InlineGlyph symbol="number" label={null} />{' '}
            {i18n('icu:EditUsernameModalBody__learn-more__title')}
          </>
        }
        description={i18n('icu:EditUsernameModalBody__learn-more__body')}
      >
        <AxoAlertDialog.Cancel>{i18n('icu:ok')}</AxoAlertDialog.Cancel>
      </AxoConfirmDialog.Root>

      <AxoConfirmDialog.Root
        open={error === UsernameReservationError.General}
        onOpenChange={() => setUsernameReservationError(undefined)}
        // @ts-expect-error ConfirmationDialog migration: Needs title
        title={null}
        description={i18n('icu:ProfileEditor--username--general-error')}
      >
        <AxoConfirmDialog.Cancel>{i18n('icu:ok')}</AxoConfirmDialog.Cancel>
      </AxoConfirmDialog.Root>

      <AxoConfirmDialog.Root
        open={error === UsernameReservationError.ConflictOrGone}
        onOpenChange={() => {
          if (nickname) {
            reserveUsername({ nickname, customDiscriminator });
          }
        }}
        // @ts-expect-error ConfirmationDialog migration: Needs title
        title={null}
        description={i18n('icu:ProfileEditor--username--reservation-gone', {
          username: reservation?.username ?? nickname ?? '',
        })}
      >
        <AxoConfirmDialog.Cancel>{i18n('icu:ok')}</AxoConfirmDialog.Cancel>
      </AxoConfirmDialog.Root>

      <AxoConfirmDialog.Root
        open={isConfirmingSave}
        onOpenChange={onCancelSave}
        // @ts-expect-error ConfirmationDialog migration: Needs title
        title={null}
        description={i18n('icu:EditUsernameModalBody__change-confirmation')}
      >
        <AxoConfirmDialog.Cancel />
        <AxoConfirmDialog.Action
          variant="destructive"
          onClick={onConfirmUsername}
        >
          {i18n('icu:EditUsernameModalBody__change-confirmation__continue')}
        </AxoConfirmDialog.Action>
      </AxoConfirmDialog.Root>

      <AxoConfirmDialog.Root
        open={isConfirmingReset}
        onOpenChange={onCancelSave}
        // @ts-expect-error ConfirmationDialog migration: Needs title
        title={null}
        description={i18n('icu:EditUsernameModalBody__recover-confirmation')}
      >
        <AxoConfirmDialog.Cancel />
        <AxoConfirmDialog.Action
          variant="destructive"
          onClick={onConfirmUsername}
        >
          {i18n('icu:EditUsernameModalBody__change-confirmation__continue')}
        </AxoConfirmDialog.Action>
      </AxoConfirmDialog.Root>
    </>
  );
}
