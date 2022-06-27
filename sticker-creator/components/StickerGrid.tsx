// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import PQueue from 'p-queue';
import type { SortEndHandler } from 'react-sortable-hoc';
import { SortableContainer, SortableElement } from 'react-sortable-hoc';
import * as styles from './StickerGrid.scss';
import type { Props as StickerFrameProps } from './StickerFrame';
import { StickerFrame } from './StickerFrame';
import { stickersDuck } from '../store';
import type { Props as DropZoneProps } from '../elements/DropZone';
import { DropZone } from '../elements/DropZone';
import { processStickerImage } from '../util/preload';
import { useI18n } from '../util/i18n';
import { MINUTE } from '../../ts/util/durations';

const queue = new PQueue({ concurrency: 3, timeout: MINUTE * 30 });

type SmartStickerFrameProps = Omit<StickerFrameProps, 'id'> & { id: string };

const SmartStickerFrame = SortableElement(
  ({ id, showGuide, mode }: SmartStickerFrameProps) => {
    const data = stickersDuck.useStickerData(id);
    const actions = stickersDuck.useStickerActions();
    const image = data.imageData ? data.imageData.src : undefined;

    return (
      <StickerFrame
        id={id}
        showGuide={showGuide}
        mode={mode}
        image={image}
        onRemove={actions.removeSticker}
        onPickEmoji={actions.setEmoji}
        emojiData={data.emoji}
      />
    );
  }
);

export type Props = Pick<StickerFrameProps, 'showGuide' | 'mode'>;

export type InnerGridProps = Props & {
  ids: Array<string>;
};

const InnerGrid = SortableContainer(
  ({ ids, mode, showGuide }: InnerGridProps) => {
    const i18n = useI18n();
    const containerClassName = ids.length > 0 ? styles.grid : styles.drop;
    const frameMode = mode === 'add' ? 'removable' : 'pick-emoji';

    const actions = stickersDuck.useStickerActions();

    const handleDrop = React.useCallback<DropZoneProps['onDrop']>(
      async paths => {
        actions.initializeStickers(paths);
        paths.forEach(path => {
          queue.add(async () => {
            try {
              const stickerImage = await processStickerImage(path);
              actions.addImageData(stickerImage);
            } catch (e) {
              window.SignalContext.log.error(
                'Error processing image:',
                e?.stack ? e.stack : String(e)
              );
              actions.removeSticker(path);
              actions.addToast({
                key:
                  (e || {}).errorMessageI18nKey ||
                  'StickerCreator--Toasts--errorProcessing',
              });
            }
          });
        });
      },
      [actions]
    );

    return (
      <div className={containerClassName}>
        {ids.length > 0 ? (
          <>
            {ids.map((p, i) => (
              <SmartStickerFrame
                key={p}
                index={i}
                id={p}
                showGuide={showGuide}
                mode={frameMode}
              />
            ))}
            {mode === 'add' && ids.length < stickersDuck.maxStickers ? (
              <StickerFrame
                showGuide={showGuide}
                mode="add"
                onDrop={handleDrop}
              />
            ) : null}
          </>
        ) : (
          <DropZone
            label={i18n('StickerCreator--DropStage--dragDrop')}
            onDrop={handleDrop}
          />
        )}
      </div>
    );
  }
);

export const StickerGrid = SortableContainer((props: Props) => {
  const ids = stickersDuck.useStickerOrder();
  const actions = stickersDuck.useStickerActions();
  const handleSortEnd = React.useCallback<SortEndHandler>(
    sortEnd => {
      actions.moveSticker(sortEnd);
    },
    [actions]
  );

  return (
    <InnerGrid
      {...props}
      ids={ids}
      axis="xy"
      onSortEnd={handleSortEnd}
      useDragHandle
    />
  );
});
