import { GiphyFetch } from '@giphy/js-fetch-api';
import type { GifChannelTypeSpec } from '../types/Gifs';
import { GIF_CHANNEL_PREFIX, GIPHY_API_KEY } from '../types/Gifs';

const createMessagePasser =
  <K extends keyof GifChannelTypeSpec>(
    ipcRenderer: Electron.IpcRenderer,
    eventName: K
  ) =>
  (
    ...args: GifChannelTypeSpec[K]['args']
  ): Promise<GifChannelTypeSpec[K]['result']> =>
    ipcRenderer.invoke(`${GIF_CHANNEL_PREFIX}:${eventName}`, ...args);

export type GiphyRendererWrapper = {
  [K in keyof GifChannelTypeSpec]: (
    ...args: GifChannelTypeSpec[K]['args']
  ) => Promise<GifChannelTypeSpec[K]['result']>;
};

export const createGiphyRendererWrapper = (
  ipcRenderer: Electron.IpcRenderer
): GiphyRendererWrapper => ({
  gifs: createMessagePasser(ipcRenderer, 'gifs'),
  search: createMessagePasser(ipcRenderer, 'search'),
  trending: createMessagePasser(ipcRenderer, 'trending'),
});

export const getUnwrappedGiphyForStorybook = (): GiphyRendererWrapper =>
  new GiphyFetch(GIPHY_API_KEY);
