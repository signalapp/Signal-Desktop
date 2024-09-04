// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import moment from 'moment';
import { compact, groupBy, sortBy } from 'lodash';

import * as log from '../../../logging/log';
import type { MediaItemType } from '../../../types/MediaItem';

import { missingCaseError } from '../../../util/missingCaseError';

type StaticSectionType = 'today' | 'yesterday' | 'thisWeek' | 'thisMonth';
type YearMonthSectionType = 'yearMonth';

type GenericSection<T> = {
  type: T;
  mediaItems: ReadonlyArray<MediaItemType>;
};
type StaticSection = GenericSection<StaticSectionType>;
type YearMonthSection = GenericSection<YearMonthSectionType> & {
  year: number;
  month: number;
};
export type Section = StaticSection | YearMonthSection;
export const groupMediaItemsByDate = (
  timestamp: number,
  mediaItems: ReadonlyArray<MediaItemType>
): Array<Section> => {
  const referenceDateTime = moment(timestamp);

  const sortedMediaItem = sortBy(mediaItems, mediaItem => {
    const { message } = mediaItem;

    return -message.receivedAt;
  });
  const messagesWithSection = sortedMediaItem.map(
    withSection(referenceDateTime)
  );
  const groupedMediaItem = groupBy(messagesWithSection, 'type');
  const yearMonthMediaItem = Object.values(
    groupBy(groupedMediaItem.yearMonth, 'order')
  ).reverse();

  return compact([
    toSection(groupedMediaItem.today),
    toSection(groupedMediaItem.yesterday),
    toSection(groupedMediaItem.thisWeek),
    toSection(groupedMediaItem.thisMonth),
    ...yearMonthMediaItem.map(toSection),
  ]);
};

const toSection = (
  messagesWithSection: Array<MediaItemWithSection> | undefined
): Section | undefined => {
  if (!messagesWithSection || messagesWithSection.length === 0) {
    return undefined;
  }

  const firstMediaItemWithSection: undefined | MediaItemWithSection =
    messagesWithSection[0];
  if (!firstMediaItemWithSection) {
    return undefined;
  }

  const mediaItems = messagesWithSection.map(
    messageWithSection => messageWithSection.mediaItem
  );
  switch (firstMediaItemWithSection.type) {
    case 'today':
    case 'yesterday':
    case 'thisWeek':
    case 'thisMonth':
      return {
        type: firstMediaItemWithSection.type,
        mediaItems,
      };
    case 'yearMonth':
      return {
        type: firstMediaItemWithSection.type,
        year: firstMediaItemWithSection.year,
        month: firstMediaItemWithSection.month,
        mediaItems,
      };
    default:
      log.error(missingCaseError(firstMediaItemWithSection));
      return undefined;
  }
};

type GenericMediaItemWithSection<T> = {
  order: number;
  type: T;
  mediaItem: MediaItemType;
};
type MediaItemWithStaticSection =
  GenericMediaItemWithSection<StaticSectionType>;
type MediaItemWithYearMonthSection =
  GenericMediaItemWithSection<YearMonthSectionType> & {
    year: number;
    month: number;
  };
type MediaItemWithSection =
  | MediaItemWithStaticSection
  | MediaItemWithYearMonthSection;

const withSection = (referenceDateTime: moment.Moment) => {
  const today = moment(referenceDateTime).startOf('day');
  const yesterday = moment(referenceDateTime).subtract(1, 'day').startOf('day');
  const thisWeek = moment(referenceDateTime).subtract(7, 'day').startOf('day');
  const thisMonth = moment(referenceDateTime).startOf('month');

  return (mediaItem: MediaItemType): MediaItemWithSection => {
    const { message } = mediaItem;
    const messageTimestamp = moment(message.receivedAtMs || message.receivedAt);

    if (messageTimestamp.isAfter(today)) {
      return {
        order: 0,
        type: 'today',
        mediaItem,
      };
    }
    if (messageTimestamp.isAfter(yesterday)) {
      return {
        order: 1,
        type: 'yesterday',
        mediaItem,
      };
    }
    if (messageTimestamp.isAfter(thisWeek)) {
      return {
        order: 2,
        type: 'thisWeek',
        mediaItem,
      };
    }
    if (messageTimestamp.isAfter(thisMonth)) {
      return {
        order: 3,
        type: 'thisMonth',
        mediaItem,
      };
    }

    const month: number = messageTimestamp.month();
    const year: number = messageTimestamp.year();

    return {
      order: year * 100 + month,
      type: 'yearMonth',
      month,
      year,
      mediaItem,
    };
  };
};
