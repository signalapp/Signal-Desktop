// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import {
  memo,
  useState,
  useCallback,
  type MouseEvent,
  type KeyboardEvent,
  type ReactNode,
  type JSX,
} from 'react';
import type { LocalizerType } from '../../types/Util.std.ts';
import type { StickerPackType } from '../../state/ducks/stickers.preload.ts';
import { UserText } from '../UserText.dom.tsx';
import { AxoConfirmDialog } from '../../axo/AxoConfirmDialog.dom.tsx';
import { AxoIconButton } from '../../axo/AxoIconButton.dom.tsx';
import { tw } from '../../axo/tw.dom.tsx';
import { OfficialChatInlineBadge } from '../conversation/OfficialChatInlineBadge.dom.tsx';
import { AxoContextMenu } from '../../axo/menus/AxoContextMenu.dom.tsx';
import { AxoSymbol } from '../../axo/AxoSymbol.dom.tsx';
import { ListBoxItem } from 'react-aria-components';

export type OwnProps = {
  readonly i18n: LocalizerType;
  readonly pack: StickerPackType;
  readonly controlType: StickerManagerPackRowControlType;
  readonly onClickPreview?: (packId: string) => unknown;
  readonly installStickerPack?: (
    packId: string,
    packKey: string,
    options: { actionSource: 'ui' }
  ) => unknown;
  readonly uninstallStickerPack?: (
    packId: string,
    packKey: string,
    options: { actionSource: 'ui' }
  ) => unknown;
};

export type Props = OwnProps;

export type StickerManagerPackRowControlType = 'install-button' | 'drag-handle';

export const StickerManagerPackRow = memo(function StickerManagerPackRowInner({
  controlType,
  i18n,
  pack,
  installStickerPack,
  uninstallStickerPack,
  onClickPreview,
}: Props) {
  const { id, key, isBlessed, title } = pack;
  const [uninstalling, setUninstalling] = useState(false);

  const clearUninstalling = useCallback(() => {
    setUninstalling(false);
  }, [setUninstalling]);

  const handleInstall = useCallback(
    (e: Event | MouseEvent) => {
      e.stopPropagation();
      if (installStickerPack) {
        installStickerPack(id, key, { actionSource: 'ui' });
      }
    },
    [id, installStickerPack, key]
  );

  const handleUninstall = useCallback(
    (e: Event) => {
      e.stopPropagation();
      if (isBlessed && uninstallStickerPack) {
        uninstallStickerPack(id, key, { actionSource: 'ui' });
      } else {
        setUninstalling(true);
      }
    },
    [id, isBlessed, key, setUninstalling, uninstallStickerPack]
  );

  const handleConfirmUninstall = useCallback(() => {
    clearUninstalling();
    if (uninstallStickerPack) {
      uninstallStickerPack(id, key, { actionSource: 'ui' });
    }
  }, [id, key, clearUninstalling, uninstallStickerPack]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (onClickPreview && (event.key === 'Enter' || event.key === 'Space')) {
        event.stopPropagation();
        event.preventDefault();

        onClickPreview(id);
      }
    },
    [onClickPreview, id]
  );

  const handleClickPreview = useCallback(
    (event: MouseEvent) => {
      if (onClickPreview) {
        event.stopPropagation();
        event.preventDefault();

        onClickPreview(id);
      }
    },
    [onClickPreview, id]
  );

  return (
    <ListBoxItem id={id} textValue={title}>
      <AxoConfirmDialog.Root
        open={uninstalling}
        onOpenChange={setUninstalling}
        // @ts-expect-error ConfirmationDialog migration: Needs title
        title={null}
        description={i18n('icu:stickers--StickerManager--UninstallWarning')}
      >
        <AxoConfirmDialog.Cancel />
        <AxoConfirmDialog.Action
          variant="strong-destructive"
          onClick={handleConfirmUninstall}
        >
          {i18n('icu:stickers--StickerManager--Uninstall')}
        </AxoConfirmDialog.Action>
      </AxoConfirmDialog.Root>
      <PackContextMenu
        i18n={i18n}
        handleInstall={handleInstall}
        handleUninstall={handleUninstall}
        isInstalled={pack.status === 'installed'}
      >
        <div
          tabIndex={0}
          // This can't be a button because we have buttons as descendants
          role="button"
          onKeyDown={handleKeyDown}
          onClick={handleClickPreview}
          className="module-sticker-manager__pack-row"
          data-testid={id}
        >
          {pack.cover ? (
            <img
              src={pack.cover.url}
              alt={pack.title}
              className="module-sticker-manager__pack-row__cover"
            />
          ) : (
            <div className="module-sticker-manager__pack-row__cover-placeholder" />
          )}
          <div className="module-sticker-manager__pack-row__meta">
            <div
              className={tw('mb-0.5 flex flex-1 type-body-medium text-primary')}
            >
              <UserText text={pack.title} />
              {pack.isBlessed ? (
                <span className={tw('ms-1')}>
                  <OfficialChatInlineBadge />
                </span>
              ) : null}
            </div>
            <div className={tw('flex flex-1 type-body-small text-secondary')}>
              {pack.author}
            </div>
          </div>
          {controlType === 'install-button' && (
            <div className="module-sticker-manager__pack-row__controls">
              {pack.status === 'installed' ? (
                <AxoIconButton.Root
                  variant="strong-secondary"
                  size="md"
                  symbol="check"
                  label={i18n('icu:stickers--StickerManager--Installed')}
                  tooltip={false}
                  disabled
                />
              ) : (
                <AxoIconButton.Root
                  variant="strong-secondary"
                  size="md"
                  symbol="plus"
                  label={i18n('icu:stickers--StickerManager--Install')}
                  onClick={handleInstall}
                />
              )}
            </div>
          )}
          {controlType === 'drag-handle' && <ItemDragHandle i18n={i18n} />}
        </div>
      </PackContextMenu>
    </ListBoxItem>
  );
});

function PackContextMenu(props: {
  i18n: LocalizerType;
  isInstalled: boolean;
  handleInstall: (e: Event) => void;
  handleUninstall: (e: Event) => void;
  children: ReactNode;
}) {
  const { i18n, isInstalled, handleInstall, handleUninstall } = props;

  return (
    <AxoContextMenu.Root>
      <AxoContextMenu.Trigger>{props.children}</AxoContextMenu.Trigger>
      <AxoContextMenu.Content>
        {isInstalled ? (
          <AxoContextMenu.Item symbol="minus-circle" onSelect={handleUninstall}>
            {i18n('icu:stickers--StickerManagerPackContextMenu--Remove')}
          </AxoContextMenu.Item>
        ) : (
          <AxoContextMenu.Item symbol="plus-circle" onSelect={handleInstall}>
            {i18n('icu:stickers--StickerManagerPackContextMenu--Add')}
          </AxoContextMenu.Item>
        )}
      </AxoContextMenu.Content>
    </AxoContextMenu.Root>
  );
}

function ItemDragHandle(props: { i18n: LocalizerType }): JSX.Element {
  const { i18n } = props;
  return (
    <span className={tw('cursor-grab text-primary')}>
      <AxoSymbol.Icon
        symbol="draghandle-alt"
        size={18}
        label={i18n('icu:stickers--StickerManagerPackDragHandle--Label')}
      />
    </span>
  );
}
