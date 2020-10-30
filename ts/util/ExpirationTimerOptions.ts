// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as Backbone from 'backbone';
import * as moment from 'moment';
import { LocalizerType } from '../types/Util';

type ExpirationTime = [
  number,
  (
    | 'second'
    | 'seconds'
    | 'minute'
    | 'minutes'
    | 'hour'
    | 'hours'
    | 'day'
    | 'week'
  )
];
const EXPIRATION_TIMES: Array<ExpirationTime> = [
  [0, 'seconds'],
  [5, 'seconds'],
  [10, 'seconds'],
  [30, 'seconds'],
  [1, 'minute'],
  [5, 'minutes'],
  [30, 'minutes'],
  [1, 'hour'],
  [6, 'hours'],
  [12, 'hours'],
  [1, 'day'],
  [1, 'week'],
];

export const TimerOption = Backbone.Model.extend({
  getName(i18n: LocalizerType) {
    return (
      i18n(['timerOption', this.get('time'), this.get('unit')].join('_')) ||
      moment.duration(this.get('time'), this.get('unit')).humanize()
    );
  },
  getAbbreviated(i18n: LocalizerType) {
    return i18n(
      ['timerOption', this.get('time'), this.get('unit'), 'abbreviated'].join(
        '_'
      )
    );
  },
});

export const ExpirationTimerOptions = new (Backbone.Collection.extend({
  model: TimerOption,
  getName(i18n: LocalizerType, seconds = 0) {
    const o = this.findWhere({ seconds });
    if (o) {
      return o.getName(i18n);
    }
    return [seconds, 'seconds'].join(' ');
  },
  getAbbreviated(i18n: LocalizerType, seconds = 0) {
    const o = this.findWhere({ seconds });
    if (o) {
      return o.getAbbreviated(i18n);
    }
    return [seconds, 's'].join('');
  },
}))(
  EXPIRATION_TIMES.map(o => {
    const duration = moment.duration(o[0], o[1]); // 5, 'seconds'
    return {
      time: o[0],
      unit: o[1],
      seconds: duration.asSeconds(),
    };
  })
);
