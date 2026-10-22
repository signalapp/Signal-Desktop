// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useState } from 'react';

import type { JSX } from 'react';

import { tw } from '../axo/tw.dom.tsx';
import { TitlebarDragArea } from './TitlebarDragArea.dom.tsx';
import { ThemeType } from '../types/Util.std.ts';

import type { LocalizerType } from '../types/Util.std.ts';
import { AxoButton } from '../axo/AxoButton.dom.tsx';
import {
  InputContainer,
  Spacer,
} from './standaloneRegistration/util/StepComponents.dom.tsx';
import { AxoDialog } from '../axo/AxoDialog.dom.tsx';
import { AxoContactList } from '../axo/items/AxoContactList.dom.tsx';
import { AxoSymbol } from '../axo/AxoSymbol.dom.tsx';

export type Props = {
  i18n: LocalizerType;
  theme: ThemeType;
  startLinkProcess: () => void;
  startStandaloneRegistration: () => void;
};

export function EntryPoint({
  i18n,
  startLinkProcess,
  startStandaloneRegistration,
  theme,
}: Props): JSX.Element {
  const [showMoreOptionsDialog, setShowMoreOptionsDialog] = useState(false);

  return (
    <div
      className={tw(
        'relative flex size-full flex-col overflow-hidden bg-surface-secondary'
      )}
    >
      <TitlebarDragArea />
      <img
        className="EntryPoint--SignalLogo"
        src={
          theme === ThemeType.light
            ? 'images/signal-logo-with-text--light.svg'
            : 'images/signal-logo-with-text--dark.svg'
        }
        alt={i18n('icu:EntryPoint--signal-logo')}
      />
      <div className={tw('min-h-10')} />
      <div className={tw('grow p-4')}>
        <div className={tw('@container/card relative size-full')}>
          <div
            className={tw(
              // oxlint-disable-next-line better-tailwindcss/no-restricted-classes
              'left-1/2',
              'absolute top-1/2 flex max-h-full w-143 max-w-full -translate-1/2 transform flex-col',
              'overflow-hidden rounded-[26px] border-[0.5px] border-secondary bg-material-dialog p-3',
              'shadow-elevation-1 shadow-no-outline'
            )}
          >
            <div
              className={tw(
                'flex size-full grow flex-col items-center overflow-x-hidden overflow-y-auto'
              )}
            >
              <Spacer className={tw('h-5')} />
              <img
                className={tw('size-80 min-h-20 min-w-20 shrink')}
                src={
                  theme === ThemeType.light
                    ? 'images/splash--light.svg'
                    : 'images/splash--dark.svg'
                }
                alt=""
              />
              <div
                className={tw(
                  'text-center type-title-large @max-sm/card:type-title-small'
                )}
              >
                {i18n('icu:EntryPoint--Title--Line1')}
              </div>
              <div
                className={tw(
                  'text-center type-title-large @max-sm/card:type-title-small'
                )}
              >
                {i18n('icu:EntryPoint--Title--Line2')}
              </div>
              <Spacer className={tw('h-12')} />
              <InputContainer className={tw('w-43.75')}>
                <AxoButton.Root
                  variant="strong-primary"
                  size="lg"
                  width="full"
                  onClick={() => startLinkProcess()}
                >
                  <AxoSymbol.InlineGlyph symbol="qrcode" label={null} />
                  &nbsp;{i18n('icu:EntryPoint--link-button')}
                </AxoButton.Root>

                <Spacer className={tw('h-3')} />
                <AxoButton.Root
                  variant="subtle-secondary"
                  size="lg"
                  width="full"
                  onClick={() => setShowMoreOptionsDialog(true)}
                >
                  {i18n('icu:EntryPoint--more-options-button')}
                </AxoButton.Root>
              </InputContainer>
              <Spacer className={tw('h-5')} />
            </div>
          </div>
        </div>
      </div>
      <div className={tw('min-h-4 text-center')}>
        <div className={tw('type-body-medium')}>
          {i18n('icu:EntryPoint--nonprofit')}
        </div>
        <div className={tw('type-body-medium')}>
          <a className={tw('text-primary')} href="https://signal.org/legal/">
            {i18n('icu:EntryPoint--terms')}
          </a>
        </div>
      </div>
      <Spacer className={tw('h-8')} />
      <MoreOptionsDialog
        i18n={i18n}
        isOpen={showMoreOptionsDialog}
        setClosed={() => setShowMoreOptionsDialog(false)}
        startStandaloneRegistration={startStandaloneRegistration}
      />
    </div>
  );
}

function MoreOptionsDialog({
  i18n,
  isOpen,
  setClosed,
  startStandaloneRegistration,
}: {
  i18n: LocalizerType;
  isOpen: boolean;
  setClosed: () => unknown;
  startStandaloneRegistration: () => unknown;
}): JSX.Element {
  return (
    <AxoDialog.Root
      open={isOpen}
      onOpenChange={open => {
        if (!open) {
          setClosed();
        }
      }}
    >
      <AxoDialog.Content size="md" escape="cancel-is-noop">
        <AxoDialog.Header>
          <AxoDialog.Title>
            {i18n('icu:EntryPoint--MoreOptions--Title')}
          </AxoDialog.Title>
          <AxoDialog.Close />
        </AxoDialog.Header>
        <AxoDialog.Body>
          <Spacer className={tw('h-5')} />
          <div className={tw('flex w-full flex-col')}>
            <AxoContactList.Root>
              <AxoContactList.Item
                key="start-registration-button"
                avatar={
                  <div
                    className={tw(
                      'flex size-9 flex-col items-center justify-center rounded-full',
                      'bg-accent-tint text-(--axo-color-legacy-official-chat-badge-text)'
                    )}
                  >
                    <AxoSymbol.Icon
                      size={18}
                      symbol="message-check"
                      label={null}
                    />
                  </div>
                }
                title={i18n(
                  'icu:EntryPoint--MoreOptions--RegistrationButton--Title'
                )}
                description={
                  <div>
                    {i18n(
                      'icu:EntryPoint--MoreOptions--RegistrationButton--Description'
                    )}
                  </div>
                }
                allowDescriptionOverflow
                onClick={() => {
                  startStandaloneRegistration();
                }}
              />
            </AxoContactList.Root>
          </div>
          <Spacer className={tw('h-5')} />
        </AxoDialog.Body>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}
