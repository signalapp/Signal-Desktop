// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import createDebug from 'debug';
import { useDispatch } from 'react-redux';
import type { ItemInterface } from 'react-sortablejs';
import { ReactSortable } from 'react-sortablejs';

import styles from './ArtGrid.module.scss';
import artFrameStyles from './ArtFrame.module.scss';
import type { Props as ArtFrameProps } from './ArtFrame';
import { ArtFrame } from './ArtFrame';
import {
  addImageData,
  addToast,
  initializeImages,
  removeImage,
  setEmoji,
  setEmojiName,
  setOrder,
} from '../slices/art';
import { useArtType, useArtData, useArtOrder } from '../selectors/art';
import type { Props as DropZoneProps } from '../elements/DropZone';
import { DropZone } from '../elements/DropZone';
import { assert } from '../util/assert';
import { getFilePath } from '../util/api';
import { processImage, ProcessImageError } from '../util/processImage';
import { useI18n } from '../contexts/I18n';
import { ArtType, MAX_STICKERS } from '../constants';

const debug = createDebug('signal:components:ArtGrid');

type SmartArtFrameProps = Omit<ArtFrameProps, 'id'> & { id: string };

function SmartArtFrame({
  artType,
  id,
  showGuide,
  mode,
}: SmartArtFrameProps): JSX.Element | null {
  const dispatch = useDispatch();
  const data = useArtData(id);
  if (!data) {
    return null;
  }

  const image = data.imageData ? data.imageData.src : undefined;

  return (
    <ArtFrame
      id={id}
      artType={artType}
      showGuide={showGuide}
      mode={mode}
      image={image}
      onRemove={(...args) => dispatch(removeImage(...args))}
      onPickEmoji={(...args) => dispatch(setEmoji(...args))}
      onEmojiNameChange={name => dispatch(setEmojiName({ id, name }))}
      emoji={data.emoji}
    />
  );
}

export type Props = Pick<ArtFrameProps, 'showGuide' | 'mode'>;

export function ArtGrid({ mode, showGuide }: Props): JSX.Element {
  const order = useArtOrder();
  const i18n = useI18n();
  const dispatch = useDispatch();
  const artType = useArtType();

  const list = React.useMemo(() => {
    assert(artType === ArtType.Sticker, 'Unexpected art type');
    const maxImages = MAX_STICKERS;
    const entries = order.map(id => ({ id, filtered: false }));

    if (mode === 'add' && order.length !== 0 && order.length < maxImages) {
      return [...entries, { id: '', filtered: true }];
    }
    return entries;
  }, [mode, artType, order]);

  const frameMode = mode === 'add' ? 'removable' : 'pick-emoji';

  const setList = React.useCallback(
    (newList: ReadonlyArray<ItemInterface>): void => {
      const newOrder = newList
        .filter(entry => !entry.filtered)
        .map(entry => entry.id)
        .filter((id: string | number): id is string => typeof id === 'string');
      dispatch(setOrder(newOrder));
    },
    [dispatch]
  );

  const handleDrop = React.useCallback<DropZoneProps['onDrop']>(
    async files => {
      dispatch(
        initializeImages(files.map(file => getFilePath(file) || file.name))
      );
      await Promise.all(
        files.map(async file => {
          try {
            const image = await processImage(file, artType);
            dispatch(addImageData(image));
          } catch (e) {
            debug('Error processing image:', e);
            dispatch(removeImage(getFilePath(file)));

            const key =
              e instanceof ProcessImageError
                ? e.errorMessageI18nKey
                : 'StickerCreator--Toasts--errorProcessing';
            dispatch(
              addToast({
                key,
              })
            );
          }
        })
      );
    },
    [dispatch, artType]
  );

  if (list.length === 0) {
    return (
      <div className={styles.drop}>
        <DropZone
          label={i18n('StickerCreator--DropStage--dragDrop')}
          onDrop={handleDrop}
        />
      </div>
    );
  }

  const frames = list.map(({ id, filtered }) => {
    if (filtered) {
      return (
        <ArtFrame
          key="new"
          artType={artType}
          showGuide={showGuide}
          mode="add"
          onDrop={handleDrop}
        />
      );
    }
    return (
      <SmartArtFrame
        key={`id:${id}`}
        artType={artType}
        id={id}
        showGuide={showGuide}
        mode={frameMode}
      />
    );
  });

  return (
    <ReactSortable
      className={styles.grid}
      list={list}
      filter={`.${artFrameStyles.nonDraggable}`}
      preventOnFilter={false}
      setList={setList}
    >
      {frames}
    </ReactSortable>
  );
}
