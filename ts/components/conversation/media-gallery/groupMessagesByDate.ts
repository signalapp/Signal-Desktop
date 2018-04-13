import moment from 'moment';
import { groupBy, sortBy } from 'lodash';

import { Message } from './propTypes/Message';


export const groupMessagesByDate = (timestamp: number, messages: Array<Message>): any => {
  const referenceDateTime = moment.utc(timestamp);
  const today = moment(referenceDateTime).startOf('day');
  const yesterday = moment(referenceDateTime).subtract(1, 'day').startOf('day');
  const thisWeek = moment(referenceDateTime).startOf('week');
  const thisMonth = moment(referenceDateTime).startOf('month');

  const sorted = sortBy(messages, (message) => -message.received_at);
  const annotations = sorted.map((message) => {
    const date = moment(message.received_at);

    if (date.isAfter(today)) {
      return {
        order: 0,
        label: 'today',
        message,
      };
    } else if (date.isAfter(yesterday)) {
      return {
        order: 1,
        label: 'yesterday',
        message,
      };
    } else if (date.isAfter(thisWeek)) {
      return {
        order: 2,
        label: 'thisWeek',
        message,
      };
    } else if (date.isAfter(thisMonth)) {
      return {
        order: 3,
        label: 'thisMonth',
        message,
      };
    }

    return {
      order: (date.year() * 100) + date.month(),
      label: 'yearMonth',
      message,
    };
  });

  return groupBy(annotations, 'label');
};
