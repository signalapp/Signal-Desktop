import React from 'react';
import FocusTrap from 'focus-trap-react';
import type { GifResult } from '@giphy/js-fetch-api';
import { GiphyFetch } from '@giphy/js-fetch-api';
import { Grid } from '@giphy/react-components';
import classNames from 'classnames';
import type { LocalizerType } from '../../types/Util';

type GiphyGif = GifResult['data'];

type Gif = {
  url: string;
  alt: string;
};

const CATEGORIES = [
  'trending',
  'celebrate',
  'love',
  'thumbsup',
  'surprised',
  'excited',
  'sad',
  'angry',
] as const;
type CategoryName = 'recent' | 'search' | typeof CATEGORIES[number];

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

function isMutableRef<T>(val: unknown): val is React.MutableRefObject<T> {
  return Boolean(
    val && Object.getOwnPropertyDescriptor(val, 'current') !== undefined
  );
}

export const GifPicker = React.memo(
  React.forwardRef<HTMLDivElement, Props>(
    ({ style, onPickGif, recentGifs, i18n }, ref) => {
      const popupWidth = React.useMemo((): number => {
        const defaultWidth = 332;
        if (isMutableRef(ref)) {
          return ref.current?.offsetWidth ?? defaultWidth;
        }
        return defaultWidth;
      }, [ref]);

      const hasRecentGifs = recentGifs.length > 0;
      const [currentTabName, setCurrentTabName] = React.useState<CategoryName>(
        hasRecentGifs ? 'recent' : 'search'
      );
      const onCategoryClickFactory = (categoryName: CategoryName) => () => {
        setCurrentTabName(categoryName);
      };

      const fetchGifs = React.useCallback((offset: number) => {
        return giphy.trending({ offset, limit: 15, type: 'gifs' });
      }, []);

      return (
        <FocusTrap>
          <div className="module-gif-picker" ref={ref} style={style}>
            <div className="module-gif-picker__header">
              <div className="module-gif-picker__header__categories">
                <div className="module-gif-picker__header__categories__slider">
                  {hasRecentGifs || true ? (
                    <button
                      type="button"
                      onClick={onCategoryClickFactory('recent')}
                      className={classNames(
                        'module-gif-picker__header__categories__slider__button',
                        'module-gif-picker__header__categories__slider__button--recents',
                        {
                          'module-gif-picker__header__categories__slider__button--selected':
                            currentTabName === 'recent',
                        }
                      )}
                      aria-label={i18n('gifs--GifPicker--Recents')}
                    />
                  ) : null}
                  <button
                    type="button"
                    onClick={onCategoryClickFactory('search')}
                    className={classNames(
                      'module-gif-picker__header__categories__slider__button',
                      'module-gif-picker__header__categories__slider__button--search',
                      {
                        'module-gif-picker__header__categories__slider__button--selected':
                          currentTabName === 'search',
                      }
                    )}
                    aria-label={i18n('gifs--GifPicker--Search')}
                  />
                  {CATEGORIES.map(category => (
                    <button
                      type="button"
                      key={category}
                      onClick={onCategoryClickFactory(category)}
                      className={classNames(
                        'module-gif-picker__header__categories__slider__button',
                        `module-gif-picker__header__categories__slider__button--${category}`,
                        {
                          'module-gif-picker__header__categories__slider__button--selected':
                            currentTabName === category,
                        }
                      )}
                      aria-label={i18n(`gifs--GifPicker--${category}`)}
                    />
                  ))}
                </div>
              </div>
            </div>
            <input />
            <div className="module-gif-picker__body">
              <Grid
                columns={3}
                fetchGifs={fetchGifs}
                width={popupWidth}
                noLink
                onGifClick={onPickGif}
                hideAttribution
              />
            </div>
          </div>
        </FocusTrap>
      );
    }
  )
);
