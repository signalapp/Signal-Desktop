// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { FC, JSX, ReactNode } from 'react';
import {
  createContext,
  memo,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import type { MuteExpiration } from '@signalapp/types';

import { AxoContextMenu } from '../axo/AxoContextMenu.dom.tsx';
import { AxoDropdownMenu } from '../axo/AxoDropdownMenu.dom.tsx';
import type { AxoMenuBuilder } from '../axo/AxoMenuBuilder.dom.tsx';
import type { LocalizerType } from '../types/Util.std.ts';
import { strictAssert } from '../util/assert.std.ts';
import type { MuteOption } from '../util/getMuteOptions.std.ts';
import { getMuteExpiration } from '../util/getMuteOptions.std.ts';
import { missingCaseError } from '../util/missingCaseError.std.ts';
import { MuteUntilDialog } from './MuteUntilDialog.dom.tsx';

function getMenuComponents(renderer: AxoMenuBuilder.Renderer) {
  switch (renderer) {
    case 'AxoDropdownMenu':
      return AxoDropdownMenu;
    case 'AxoContextMenu':
      return AxoContextMenu;
    default:
      throw missingCaseError(renderer);
  }
}

type MuteNotificationsMenuValue = Readonly<{
  i18n: LocalizerType;
  onMuteUntilClick: (onSubmit: (expiration: MuteExpiration) => void) => void;
}>;

const MuteUntilDialogContext = createContext<MuteNotificationsMenuValue | null>(
  null
);

function useMuteUntilDialog(): MuteNotificationsMenuValue {
  const value = useContext(MuteUntilDialogContext);
  strictAssert(
    value != null,
    'Missing <MuteUntilDialogProvider> around the menu'
  );
  return value;
}

export type MuteUntilDialogProviderProps = {
  i18n: LocalizerType;
  children: ReactNode;
};

export function MuteUntilDialogProvider(
  props: MuteUntilDialogProviderProps
): JSX.Element {
  const [muteUntilDialog, setMuteUntilDialog] = useState<
    false | { show: true; onSubmit: (expiration: MuteExpiration) => void }
  >(false);

  const handleMuteUntilClose = useCallback(() => {
    setMuteUntilDialog(false);
  }, []);

  const handleMuteUntilSubmit = useCallback(
    (expiration: MuteExpiration) => {
      if (muteUntilDialog === false) {
        return;
      }
      setMuteUntilDialog(false);
      muteUntilDialog.onSubmit(expiration);
    },
    [muteUntilDialog]
  );

  const value = useMemo((): MuteNotificationsMenuValue => {
    return {
      i18n: props.i18n,
      onMuteUntilClick: (onSubmit: (expiration: MuteExpiration) => void) =>
        setMuteUntilDialog({ show: true, onSubmit }),
    };
  }, [props.i18n]);

  return (
    <MuteUntilDialogContext.Provider value={value}>
      {props.children}
      <MuteUntilDialog
        i18n={props.i18n}
        open={muteUntilDialog !== false}
        onSubmit={handleMuteUntilSubmit}
        onClose={handleMuteUntilClose}
      />
    </MuteUntilDialogContext.Provider>
  );
}

type MuteNotificationsMenuItemsProps = Readonly<{
  i18n: LocalizerType;
  renderer: AxoMenuBuilder.Renderer;
  label?: string;
  options: ReadonlyArray<MuteOption>;
  onMuteExpiration: (expiration: MuteExpiration) => void;
  onMuteUntilClick: () => void;
}>;

const MuteNotificationsMenuItems: FC<MuteNotificationsMenuItemsProps> = memo(
  function MuteNotificationsMenuItems(props) {
    const { label, options, onMuteExpiration, onMuteUntilClick } = props;
    const Menu = getMenuComponents(props.renderer);

    return (
      <>
        {label ? <Menu.Label>{label}</Menu.Label> : null}
        {options.map(option => {
          const { value } = option;
          return (
            <Menu.Item
              key={option.name}
              disabled={option.disabled}
              onSelect={() => {
                if (value.type === 'custom') {
                  onMuteUntilClick();
                } else {
                  onMuteExpiration(getMuteExpiration(value));
                }
              }}
            >
              {option.name}
            </Menu.Item>
          );
        })}
      </>
    );
  }
);

export type MuteNotificationsSubMenuProps = Readonly<{
  i18n: LocalizerType;
  renderer: AxoMenuBuilder.Renderer;
  title: string;
  label?: string;
  options: ReadonlyArray<MuteOption>;
  children?: ReactNode;
  onMuteExpiration: (expiration: MuteExpiration) => void;
}>;

/**
 * Requires a MuteUntilDialogProvider to show the mute until dialog even after the menu is unmounted
 */
export const MuteNotificationsSubMenu: FC<MuteNotificationsSubMenuProps> = memo(
  function MuteNotificationsSubMenu(props) {
    const { onMuteUntilClick } = useMuteUntilDialog();
    const Menu = getMenuComponents(props.renderer);

    return (
      <Menu.Sub>
        <Menu.SubTrigger symbol="bell-slash">{props.title}</Menu.SubTrigger>
        <Menu.SubContent>
          {props.children}
          <MuteNotificationsMenuItems
            i18n={props.i18n}
            renderer={props.renderer}
            label={props.label}
            options={props.options}
            onMuteExpiration={props.onMuteExpiration}
            onMuteUntilClick={() => onMuteUntilClick(props.onMuteExpiration)}
          />
        </Menu.SubContent>
      </Menu.Sub>
    );
  }
);

export type MuteNotificationsDropdownMenuProps = Readonly<{
  i18n: LocalizerType;
  label: string;
  options: ReadonlyArray<MuteOption>;
  onMuteExpiration: (expiration: MuteExpiration) => void;
  /** The button that opens the menu. */
  children: ReactNode;
}>;

export const MuteNotificationsDropdownMenu: FC<MuteNotificationsDropdownMenuProps> =
  memo(function MuteNotificationsDropdownMenu(props) {
    const { i18n, options, onMuteExpiration } = props;
    const [isShowingMuteUntilDialog, setIsShowingMuteUntilDialog] =
      useState(false);

    const handleMuteUntilSubmit = useCallback(
      (expiration: MuteExpiration) => {
        setIsShowingMuteUntilDialog(false);
        onMuteExpiration(expiration);
      },
      [onMuteExpiration]
    );

    return (
      <>
        <AxoDropdownMenu.Root>
          <AxoDropdownMenu.Trigger>{props.children}</AxoDropdownMenu.Trigger>
          <AxoDropdownMenu.Content>
            <MuteNotificationsMenuItems
              i18n={i18n}
              renderer="AxoDropdownMenu"
              label={props.label}
              options={options}
              onMuteExpiration={onMuteExpiration}
              onMuteUntilClick={() => setIsShowingMuteUntilDialog(true)}
            />
          </AxoDropdownMenu.Content>
        </AxoDropdownMenu.Root>
        <MuteUntilDialog
          open={isShowingMuteUntilDialog}
          i18n={i18n}
          onSubmit={handleMuteUntilSubmit}
          onClose={() => setIsShowingMuteUntilDialog(false)}
        />
      </>
    );
  });
