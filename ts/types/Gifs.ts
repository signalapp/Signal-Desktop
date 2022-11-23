import type {
  GifsResult,
  SearchOptions,
  TrendingOptions,
} from '@giphy/js-fetch-api';

export const GIF_CHANNEL_PREFIX = 'giphy-wrapper';

// Signal iOS API Key, taken from
// https://github.com/signalapp/Signal-iOS/blob/main/SignalServiceKit/src/Network/API/Giphy/GiphyAPI.swift
// TODO: Replace this with a different API key
export const GIPHY_API_KEY = 'ZsUpUm2L6cVbvei347EQNp7HrROjbOdc';

export type GifChannelTypeSpec = {
  search: {
    args: [string, SearchOptions | undefined];
    result: GifsResult;
  };
  gifs: {
    args: [Array<string>];
    result: GifsResult;
  };
  trending: {
    args: [TrendingOptions | undefined];
    result: GifsResult;
  };
};
