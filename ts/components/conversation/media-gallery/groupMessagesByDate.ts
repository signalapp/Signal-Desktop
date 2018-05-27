import moment from 'moment';
import { compact, groupBy, sortBy } from 'lodash';

import { Message } from './types/Message';
// import { missingCaseError } from '../../../util/missingCaseError';

type StaticSectionType = 'today' | 'yesterday' | 'thisWeek' | 'thisMonth';
type YearMonthSectionType = 'yearMonth';

interface GenericSection<T> {
  type: T;
  messages: Array<Message>;
}
type StaticSection = GenericSection<StaticSectionType>;
type YearMonthSection = GenericSection<YearMonthSectionType> & {
  year: number;
  month: number;
};
export type Section = StaticSection | YearMonthSection;
export const groupMessagesByDate = (
  timestamp: number,
  messages: Array<Message>
): Array<Section> => {
  const referenceDateTime = moment.utc(timestamp);

  const sortedMessages = sortBy(messages, message => -message.received_at);
  const messagesWithSection = sortedMessages.map(
    withSection(referenceDateTime)
  );
  const groupedMessages = groupBy(messagesWithSection, 'type');
  const yearMonthMessages = Object.values(
    groupBy(groupedMessages.yearMonth, 'order')
  ).reverse();

  return compact([
    toSection(groupedMessages.today),
    toSection(groupedMessages.yesterday),
    toSection(groupedMessages.thisWeek),
    toSection(groupedMessages.thisMonth),
    ...yearMonthMessages.map(toSection),
  ]);
};

const toSection = (
  messagesWithSection: Array<MessageWithSection> | undefined
): Section | null => {
  if (!messagesWithSection || messagesWithSection.length === 0) {
    return null;
  }

  const firstMessageWithSection: MessageWithSection = messagesWithSection[0];
  if (!firstMessageWithSection) {
    return null;
  }

  const messages = messagesWithSection.map(
    messageWithSection => messageWithSection.message
  );
  switch (firstMessageWithSection.type) {
    case 'today':
    case 'yesterday':
    case 'thisWeek':
    case 'thisMonth':
      return {
        type: firstMessageWithSection.type,
        messages,
      };
    case 'yearMonth':
      return {
        type: firstMessageWithSection.type,
        year: firstMessageWithSection.year,
        month: firstMessageWithSection.month,
        messages,
      };
    default:
      // NOTE: Investigate why we get the following error:
      // error TS2345: Argument of type 'any' is not assignable to parameter
      // of type 'never'.
      // return missingCaseError(firstMessageWithSection.type);
      return null;
  }
};

interface GenericMessageWithSection<T> {
  order: number;
  type: T;
  message: Message;
}
type MessageWithStaticSection = GenericMessageWithSection<StaticSectionType>;
type MessageWithYearMonthSection = GenericMessageWithSection<
  YearMonthSectionType
> & {
  year: number;
  month: number;
};
type MessageWithSection =
  | MessageWithStaticSection
  | MessageWithYearMonthSection;

const withSection = (referenceDateTime: moment.Moment) => (
  message: Message
): MessageWithSection => {
  const today = moment(referenceDateTime).startOf('day');
  const yesterday = moment(referenceDateTime)
    .subtract(1, 'day')
    .startOf('day');
  const thisWeek = moment(referenceDateTime).startOf('isoWeek');
  const thisMonth = moment(referenceDateTime).startOf('month');

  const messageReceivedDate = moment.utc(message.received_at);
  if (messageReceivedDate.isAfter(today)) {
    return {
      order: 0,
      type: 'today',
      message,
    };
  }
  if (messageReceivedDate.isAfter(yesterday)) {
    return {
      order: 1,
      type: 'yesterday',
      message,
    };
  }
  if (messageReceivedDate.isAfter(thisWeek)) {
    return {
      order: 2,
      type: 'thisWeek',
      message,
    };
  }
  if (messageReceivedDate.isAfter(thisMonth)) {
    return {
      order: 3,
      type: 'thisMonth',
      message,
    };
  }

  const month: number = messageReceivedDate.month();
  const year: number = messageReceivedDate.year();

  return {
    order: year * 100 + month,
    type: 'yearMonth',
    month,
    year,
    message,
  };
};
