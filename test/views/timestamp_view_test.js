/* global moment, Whisper */

'use strict';

describe('TimestampView', () => {
  it('formats long-ago timestamps correctly', () => {
    const timestamp = Date.now();
    const briefView = new Whisper.TimestampView({ brief: true }).render();
    const extendedView = new Whisper.ExtendedTimestampView().render();

    // Helper functions to check absolute and relative timestamps

    // Helper to check an absolute TS for an exact match
    const check = (view, ts, expected) => {
      const result = view.getRelativeTimeSpanString(ts);
      assert.strictEqual(result, expected);
    };

    // Helper to check relative times for an exact match against both views
    const checkDiff = (secAgo, expectedBrief, expectedExtended) => {
      check(briefView, timestamp - secAgo * 1000, expectedBrief);
      check(extendedView, timestamp - secAgo * 1000, expectedExtended);
    };

    // Helper to check an absolute TS for an exact match against both views
    const checkAbs = (ts, expectedBrief, expectedExtended) => {
      if (!expectedExtended) {
        // eslint-disable-next-line no-param-reassign
        expectedExtended = expectedBrief;
      }
      check(briefView, ts, expectedBrief);
      check(extendedView, ts, expectedExtended);
    };

    // Helper to check an absolute TS for a match at the beginning against
    const checkStartsWith = (view, ts, expected) => {
      const result = view.getRelativeTimeSpanString(ts);
      const regexp = new RegExp(`^${expected}`);
      assert.match(result, regexp);
    };

    // check integer timestamp, JS Date object and moment object
    checkAbs(timestamp, 'now', 'now');
    checkAbs(new Date(), 'now', 'now');
    checkAbs(moment(), 'now', 'now');

    // check recent timestamps
    checkDiff(30, 'now', 'now'); // 30 seconds
    checkDiff(40 * 60, '40 minutes', '40 minutes ago');
    checkDiff(60 * 60, '1 hour', '1 hour ago');
    checkDiff(125 * 60, '2 hours', '2 hours ago');

    // set to third of month to avoid problems on the 29th/30th/31st
    const lastMonth = moment()
      .subtract(1, 'month')
      .date(3);
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    check(briefView, lastMonth, `${months[lastMonth.month()]} 3`);
    checkStartsWith(extendedView, lastMonth, `${months[lastMonth.month()]} 3`);

    // subtract 26 hours to be safe in case of DST stuff
    const yesterday = new Date(timestamp - 26 * 60 * 60 * 1000);
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    check(briefView, yesterday, daysOfWeek[yesterday.getDay()]);
    checkStartsWith(extendedView, yesterday, daysOfWeek[yesterday.getDay()]);

    // Check something long ago
    // months are zero-indexed in JS for some reason
    check(briefView, new Date(2012, 4, 5, 17, 30, 0), 'May 5, 2012');
    checkStartsWith(
      extendedView,
      new Date(2012, 4, 5, 17, 30, 0),
      'May 5, 2012'
    );
  });

  describe('updates within a minute reasonable intervals', () => {
    let view;
    beforeEach(() => {
      view = new Whisper.TimestampView();
    });
    afterEach(() => {
      clearTimeout(view.timeout);
    });

    it('updates timestamps this minute within a minute', () => {
      const now = Date.now();
      view.$el.attr('data-timestamp', now - 1000);
      view.update();
      assert.isAbove(view.delay, 0); // non zero
      assert.isBelow(view.delay, 60 * 1000); // < minute
    });

    it('updates timestamps from this hour within a minute', () => {
      const now = Date.now();
      view.$el.attr('data-timestamp', now - 1000 - 1000 * 60 * 5); // 5 minutes and 1 sec ago
      view.update();
      assert.isAbove(view.delay, 0); // non zero
      assert.isBelow(view.delay, 60 * 1000); // minute
    });

    it('updates timestamps from today within an hour', () => {
      const now = Date.now();
      view.$el.attr('data-timestamp', now - 1000 - 1000 * 60 * 60 * 5); // 5 hours and 1 sec ago
      view.update();
      assert.isAbove(view.delay, 60 * 1000); // minute
      assert.isBelow(view.delay, 60 * 60 * 1000); // hour
    });

    it('updates timestamps from this week within a day', () => {
      const now = Date.now();
      view.$el.attr('data-timestamp', now - 1000 - 6 * 24 * 60 * 60 * 1000); // 6 days and 1 sec ago
      view.update();
      assert.isAbove(view.delay, 60 * 60 * 1000); // hour
      assert.isBelow(view.delay, 36 * 60 * 60 * 1000); // day and a half
    });

    it('does not updates very old timestamps', () => {
      const now = Date.now();
      // return falsey value for long ago dates that don't update
      view.$el.attr('data-timestamp', now - 8 * 24 * 60 * 60 * 1000);
      view.update();
      assert.notOk(view.delay);
    });
  });
});
