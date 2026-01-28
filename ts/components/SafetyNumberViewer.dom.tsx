// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import { AxoSymbol } from '../axo/AxoSymbol.dom.js';
import { AxoButton } from '../axo/AxoButton.dom.js';
import { AxoDialog } from '../axo/AxoDialog.dom.js';
import { QrCode } from './QrCode.dom.js';
import type { ConversationType } from '../state/ducks/conversations.preload.js';
import { I18n } from './I18n.dom.js';
import { SpinnerV2 } from './SpinnerV2.dom.js';
import type { LocalizerType } from '../types/Util.std.js';
import type { SafetyNumberType } from '../types/safetyNumber.std.js';
import {
  SAFETY_NUMBER_URL,
  KEY_TRANSPARENCY_URL,
} from '../types/support.std.js';
import type { KeyTransparencyStatusType } from '../types/KeyTransparency.d.ts';
import { missingCaseError } from '../util/missingCaseError.std.js';
import { tw, type TailwindStyles } from '../axo/tw.dom.js';

export type PropsType = {
  contact: ConversationType;
  i18n: LocalizerType;
  onClose: () => void;
  safetyNumber: SafetyNumberType | null;
  toggleVerified: (contact: ConversationType) => void;
  verificationDisabled: boolean | null;
  keyTransparencyStatus: KeyTransparencyStatusType;
  isKeyTransparencyEnabled: boolean;
  checkKeyTransparency: () => unknown;
};

export function SafetyNumberViewer({
  contact,
  i18n,
  onClose,
  safetyNumber,
  toggleVerified,
  verificationDisabled,
  keyTransparencyStatus,
  isKeyTransparencyEnabled,
  checkKeyTransparency,
}: PropsType): React.JSX.Element | null {
  const containerClassName = tw(
    'flex flex-col items-center justify-center gap-4 pb-8'
  );

  if (!safetyNumber) {
    return (
      <div className={containerClassName}>
        <div>{i18n('icu:cannotGenerateSafetyNumber')}</div>
        <div className={tw('text-end')}>
          <AxoButton.Root variant="primary" size="lg" onClick={onClose}>
            {i18n('icu:ok')}
          </AxoButton.Root>
        </div>
      </div>
    );
  }

  const { isVerified } = contact;
  const verifyButtonText = isVerified
    ? i18n('icu:SafetyNumberViewer__clearVerification')
    : i18n('icu:SafetyNumberViewer__markAsVerified');

  const numberBlocks = safetyNumber.numberBlocks.join(' ');

  const safetyNumberCard = (
    <div
      className={tw(
        'flex w-full flex-col items-center gap-4 rounded-[18px] bg-color-fill-primary px-5 pt-7.5 pb-5'
      )}
    >
      <QrCode
        className={tw(
          'size-30 rounded-[8px] p-2.5',
          'bg-background-primary scheme-light'
        )}
        data={safetyNumber.qrData}
        alt={i18n('icu:Install__scan-this-code')}
      />
      <div className={tw('w-50 font-mono text-label-primary-on-color')}>
        {numberBlocks}
      </div>

      <div className={tw('scheme-light')}>
        <AxoButton.Root
          disabled={verificationDisabled ?? false}
          onClick={() => {
            toggleVerified(contact);
          }}
          size="lg"
          variant="floating-secondary"
        >
          {verifyButtonText}
        </AxoButton.Root>
      </div>
    </div>
  );

  let keyTransparency: JSX.Element | undefined;
  if (isKeyTransparencyEnabled) {
    keyTransparency = (
      <KeyTransparency
        i18n={i18n}
        status={keyTransparencyStatus}
        contact={contact}
        checkKeyTransparency={checkKeyTransparency}
      />
    );
  }

  return (
    <div className={containerClassName}>
      {safetyNumberCard}

      <div className={tw('text-center type-body-small text-label-secondary')}>
        <I18n
          i18n={i18n}
          id="icu:SafetyNumberViewer__hint-v2"
          components={{ name: contact.title }}
        />
        &ensp;
        <a
          href={SAFETY_NUMBER_URL}
          rel="noreferrer"
          target="_blank"
          className={tw('text-label-primary')}
        >
          <I18n i18n={i18n} id="icu:SafetyNumberViewer__learn_more" />
        </a>
      </div>

      {keyTransparency}
    </div>
  );
}

type KeyTransparencyPropsType = Readonly<{
  i18n: LocalizerType;
  contact: ConversationType;
  status: KeyTransparencyStatusType;
  checkKeyTransparency: () => unknown;
}>;

function KeyTransparency({
  i18n,
  status,
  contact,
  checkKeyTransparency,
}: KeyTransparencyPropsType): JSX.Element {
  const [popup, setPopup] = useState<undefined | PopupPropsType['type']>();

  const resetPopup = useCallback(() => {
    setPopup(undefined);
  }, []);

  const onKeyTransparencyClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();

      switch (status) {
        case 'idle':
          return checkKeyTransparency();
        case 'running':
          return undefined;
        case 'unavailable':
        case 'ok':
        case 'fail':
          setPopup(status);
          return undefined;
        default:
          throw missingCaseError(status);
      }
    },
    [checkKeyTransparency, status]
  );

  let buttonText: string;
  let icon: 'key' | 'info' | 'check-circle-fill';
  let disabled = false;
  let arrow = false;
  let extraIconStyles: TailwindStyles | undefined;
  let spinner: JSX.Element | undefined;
  switch (status) {
    case 'idle':
      icon = 'key';
      buttonText = i18n(
        'icu:SafetyNumberViewer__KeyTransparency__button--idle'
      );
      break;
    case 'running':
      disabled = true;
      icon = 'info';
      buttonText = i18n(
        'icu:SafetyNumberViewer__KeyTransparency__button--running'
      );
      spinner = (
        <SpinnerV2
          variant="axo-button-spinner-secondary"
          size={20}
          strokeWidth={2}
        />
      );
      break;
    case 'ok':
      arrow = true;
      buttonText = i18n('icu:SafetyNumberViewer__KeyTransparency__button--ok');
      extraIconStyles = tw('text-color-label-affirmative');
      icon = 'check-circle-fill';
      break;
    case 'unavailable':
    case 'fail':
      arrow = true;
      buttonText = i18n(
        'icu:SafetyNumberViewer__KeyTransparency__button--fail'
      );
      icon = 'info';
      break;
    default:
      throw missingCaseError(status);
  }

  return (
    <div className={tw('w-full')}>
      <h3 className={tw('mt-6 mb-3 type-body-medium font-medium')}>
        {i18n('icu:SafetyNumberViewer__KeyTransparency__title')}
      </h3>

      <button
        type="button"
        disabled={disabled}
        onClick={onKeyTransparencyClick}
        className={tw(
          'h-12 w-full rounded-full px-5 py-3.5',
          'bg-fill-secondary text-label-primary',
          'pressed:bg-fill-secondary-pressed'
        )}
      >
        <AnimatePresence exitBeforeEnter initial={false}>
          <motion.div
            className={tw('flex h-5 items-center')}
            key={status}
            initial={{
              opacity: 0,
            }}
            transition={{
              delay: 0.3,
              duration: 0.25,

              type: 'spring',
              stiffness: 795.7,
              damping: 48,
              mass: 1,
            }}
            animate={{
              opacity: 1,
            }}
            exit={{
              opacity: 0,
              transition: {
                delay: 0,
                duration: 0.1,

                type: 'spring',
                stiffness: 5003,
                damping: 120,
                mass: 1,
              },
            }}
          >
            <span className={tw('me-3 size-5 font-regular', extraIconStyles)}>
              {spinner ?? (
                <AxoSymbol.Icon size={20} symbol={icon} label={null} />
              )}
            </span>
            {buttonText}
            {arrow && (
              <AxoSymbol.Icon size={16} symbol="chevron-[end]" label={null} />
            )}
          </motion.div>
        </AnimatePresence>
      </button>

      <div className={tw('mt-4 type-body-small text-label-secondary')}>
        <I18n i18n={i18n} id="icu:SafetyNumberViewer__KeyTransparency__hint" />
        &ensp;
        <a
          href={KEY_TRANSPARENCY_URL}
          rel="noreferrer"
          target="_blank"
          className={tw('text-label-primary')}
        >
          <I18n
            i18n={i18n}
            id="icu:SafetyNumberViewer__KeyTransparency__learn_more"
          />
        </a>
      </div>

      {popup && (
        <Popup
          i18n={i18n}
          contact={contact}
          type={popup}
          onClose={resetPopup}
        />
      )}
    </div>
  );
}

type PopupPropsType = Readonly<{
  i18n: LocalizerType;
  contact: ConversationType;
  type: 'ok' | 'fail' | 'unavailable';
  onClose: () => void;
}>;

function Popup({ i18n, contact, type, onClose }: PopupPropsType): JSX.Element {
  let icon: 'check-circle' | 'info';
  let title: string;
  let body: string;

  switch (type) {
    case 'ok':
      icon = 'check-circle';
      title = i18n('icu:SafetyNumberViewer__KeyTransparency__popup--ok__title');
      body = i18n('icu:SafetyNumberViewer__KeyTransparency__popup--ok__body');
      break;
    case 'fail':
      icon = 'info';
      title = i18n(
        'icu:SafetyNumberViewer__KeyTransparency__popup--fail__title'
      );
      body = i18n(
        'icu:SafetyNumberViewer__KeyTransparency__popup--fail__body',
        {
          name: contact.title,
        }
      );
      break;
    case 'unavailable':
      icon = 'info';
      // Intentionally the same as in 'fail'
      title = i18n(
        'icu:SafetyNumberViewer__KeyTransparency__popup--fail__title'
      );
      body = i18n(
        'icu:SafetyNumberViewer__KeyTransparency__popup--unavailable__body'
      );
      break;
    default:
      throw missingCaseError(type);
  }

  return (
    <AxoDialog.Root open>
      <AxoDialog.Content size="xs" escape="cancel-is-noop">
        <AxoDialog.Body>
          <div className={tw('text-center')}>
            <div
              className={tw(
                'inline-flex items-center justify-center',
                'mt-6.5 mb-2.5 size-7 rounded-full',
                'text-center align-middle text-[28px] leading-none font-light',
                'bg-color-fill-primary-pressed/20 text-color-fill-primary-pressed'
              )}
            >
              <AxoSymbol.InlineGlyph symbol={icon} label={null} />
            </div>
            <h3 className={tw('mb-1.5 type-title-small text-label-primary')}>
              {title}
            </h3>
            <div className={tw('mb-2 type-body-medium text-label-secondary')}>
              {body}
            </div>
          </div>
        </AxoDialog.Body>
        <AxoDialog.Footer>
          <AxoDialog.Action variant="primary" onClick={onClose}>
            {i18n('icu:SafetyNumberViewer__KeyTransparency__popup__okay')}
          </AxoDialog.Action>
        </AxoDialog.Footer>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}
