import moment from 'moment';
import { compact, groupBy, sortBy } from 'lodash';

import { MediaItemType } from '../../LightboxGallery';

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
  // Need to trick moment into doing comparisons on localized times.
  //  Otherwise groupings will be based on GMT and could cause
  //  confusion when a grouped item is displayed as May 1st but is
  //  in the April group.
  const localizedRefISOString = moment(timestamp).format(
    'YYYY-MM-DD[T]HH:mm:ss.SSS[Z]'
  );
  const referenceDateTime = moment.utc(localizedRefISOString);

  const sortedMediaItem = sortBy(mediaItems, mediaItem => {
    const { message } = mediaItem;

    return -message.received_at;
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
    return;
  }

  const firstMediaItemWithSection: MediaItemWithSection =
    messagesWithSection[0];
  if (!firstMediaItemWithSection) {
    return;
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
      // NOTE: Investigate why we get the following error:
      // error TS2345: Argument of type 'any' is not assignable to parameter
      // of type 'never'.
      // return missingCaseError(firstMediaItemWithSection.type);
      return;
  }
};

interface GenericMediaItemWithSection<T> {
  order: number;
  type: T;
  mediaItem: MediaItemType;
}
type MediaItemWithStaticSection = GenericMediaItemWithSection<
  StaticSectionType
>;
type MediaItemWithYearMonthSection = GenericMediaItemWithSection<
  YearMonthSectionType
> & {
  year: number;
  month: number;
};
type MediaItemWithSection =
  | MediaItemWithStaticSection
  | MediaItemWithYearMonthSection;

const withSection = (referenceDateTime: moment.Moment) => (
  mediaItem: MediaItemType
): MediaItemWithSection => {
  const today = moment(referenceDateTime).startOf('day');
  const yesterday = moment(referenceDateTime)
    .subtract(1, 'day')
    .startOf('day');
  const thisWeek = moment(referenceDateTime).startOf('isoWeek');
  const thisMonth = moment(referenceDateTime).startOf('month');

  const { message } = mediaItem;

  const localizedReceivedISODate = moment(message.received_at).format(
    'YYYY-MM-DD[T]HH:mm:ss.SSS[Z]'
  );
  const mediaItemReceivedDate = moment.utc(localizedReceivedISODate);
  if (mediaItemReceivedDate.isSameOrAfter(today)) {
    return {
      order: 0,
      type: 'today',
      mediaItem,
    };
  }
  if (mediaItemReceivedDate.isSameOrAfter(yesterday)) {
    return {
      order: 1,
      type: 'yesterday',
      mediaItem,
    };
  }
  if (mediaItemReceivedDate.isSameOrAfter(thisWeek)) {
    return {
      order: 2,
      type: 'thisWeek',
      mediaItem,
    };
  }
  if (mediaItemReceivedDate.isSameOrAfter(thisMonth)) {
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
