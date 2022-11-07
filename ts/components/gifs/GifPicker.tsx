import React from 'react';
import FocusTrap from 'focus-trap-react';
import type { GifResult } from '@giphy/js-fetch-api';
import { GiphyFetch } from '@giphy/js-fetch-api';
import { Grid } from '@giphy/react-components';
import type { LocalizerType } from '../../types/Util';

type GiphyGif = GifResult['data'];

type Gif = {
  url: string;
  alt: string;
};

export type Props = Readonly<{
  i18n: LocalizerType;
  onClose: () => void;
  onPickGif: () => void;
  recentGifs: ReadonlyArray<Gif>;
  showPickerHint?: boolean;
  style?: React.HTMLProps<HTMLDivElement>['style'];
}>;

// Signal iOS API Key, taken from
// https://github.com/signalapp/Signal-iOS/blob/main/SignalServiceKit/src/Network/API/Giphy/GiphyAPI.swift
// TODO: Replace this with a different API key
const API_KEY = 'ZsUpUm2L6cVbvei347EQNp7HrROjbOdc';

const giphy = new GiphyFetch(API_KEY);

export const GifPicker = React.memo(
  React.forwardRef<HTMLDivElement, Props>(({ style, onPickGif }, ref) => {
    const fetchGifs = React.useCallback(
      (offset: number) => giphy.trending({ offset, limit: 15, type: 'gifs' }),
      []
    );
    return (
      <FocusTrap>
        <div className="module-gif-picker" ref={ref} style={style}>
          <div className="module-gif-picker__header" />
          <input />
          <div className="module-gif-picker__body">
            <Grid
              columns={3}
              fetchGifs={fetchGifs}
              width={100}
              noLink
              onGifClick={onPickGif}
              hideAttribution
            />
          </div>
        </div>
      </FocusTrap>
    );
  })
);
