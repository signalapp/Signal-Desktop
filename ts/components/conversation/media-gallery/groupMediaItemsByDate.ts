import moment from 'moment';
import { compact, groupBy, sortBy } from 'lodash';
import { MediaItemType } from '../../lightbox/LightboxGallery';

// import { missingCaseError } from '../../../util/missingCaseError';

type StaticSectionType = 'today' | 'yesterday' | 'thisWeek' | 'thisMonth';
type YearMonthSectionType = 'yearMonth';

interface GenericSection<T> {
  type: T;
  mediaItems: Array<MediaItemType>;
}
type StaticSection = GenericSection<StaticSectionType>;
type YearMonthSection = GenericSection<YearMonthSectionType> & {
  year: number;
  month: number;
};
export type Section = StaticSection | YearMonthSection;
export const groupMediaItemsByDate = (
  timestamp: number,
  mediaItems: Array<MediaItemType>
): Array<Section> => {
  const referenceDateTime = moment.utc(timestamp);

  const sortedMediaItem = sortBy(mediaItems, mediaItem => {
    const { messageTimestamp } = mediaItem;

    return -messageTimestamp;
  });
  const messagesWithSection = sortedMediaItem.map(withSection(referenceDateTime));
  const groupedMediaItem = groupBy(messagesWithSection, 'type');
  const yearMonthMediaItem = Object.values(groupBy(groupedMediaItem.yearMonth, 'order')).reverse();

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

  const firstMediaItemWithSection: MediaItemWithSection = messagesWithSection[0];
  if (!firstMediaItemWithSection) {
    return undefined;
  }

  const mediaItems = messagesWithSection.map(messageWithSection => messageWithSection.mediaItem);
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
      return undefined;
  }
};

interface GenericMediaItemWithSection<T> {
  order: number;
  type: T;
  mediaItem: MediaItemType;
}
type MediaItemWithStaticSection = GenericMediaItemWithSection<StaticSectionType>;
type MediaItemWithYearMonthSection = GenericMediaItemWithSection<YearMonthSectionType> & {
  year: number;
  month: number;
};
type MediaItemWithSection = MediaItemWithStaticSection | MediaItemWithYearMonthSection;

const withSection =
  (referenceDateTime: moment.Moment) =>
  (mediaItem: MediaItemType): MediaItemWithSection => {
    const today = moment(referenceDateTime).startOf('day');
    const yesterday = moment(referenceDateTime).subtract(1, 'day').startOf('day');
    const thisWeek = moment(referenceDateTime).startOf('isoWeek');
    const thisMonth = moment(referenceDateTime).startOf('month');

    const { messageTimestamp } = mediaItem;
    const mediaItemReceivedDate = moment.utc(messageTimestamp);
    if (mediaItemReceivedDate.isAfter(today)) {
      return {
        order: 0,
        type: 'today',
        mediaItem,
      };
    }
    if (mediaItemReceivedDate.isAfter(yesterday)) {
      return {
        order: 1,
        type: 'yesterday',
        mediaItem,
      };
    }
    if (mediaItemReceivedDate.isAfter(thisWeek)) {
      return {
        order: 2,
        type: 'thisWeek',
        mediaItem,
      };
    }
    if (mediaItemReceivedDate.isAfter(thisMonth)) {
      return {
        order: 3,
        type: 'thisMonth',
        mediaItem,
      };
    }

    const month: number = mediaItemReceivedDate.month();
    const year: number = mediaItemReceivedDate.year();

    return {
      order: year * 100 + month,
      type: 'yearMonth',
      month,
      year,
      mediaItem,
    };
  };
