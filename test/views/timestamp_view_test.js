/*
 * vim: ts=4:sw=4:expandtab
 */
'use strict';

describe('TimestampView', function() {
  it('formats long-ago timestamps correctly', function() {
    var timestamp = Date.now();
    var brief_view = new Whisper.TimestampView({ brief: true }).render(),
      ext_view = new Whisper.ExtendedTimestampView().render();

    // Helper functions to check absolute and relative timestamps

    // Helper to check an absolute TS for an exact match
    var check = function(view, ts, expected) {
      var result = view.getRelativeTimeSpanString(ts);
      assert.strictEqual(result, expected);
    };

    // Helper to check relative times for an exact match against both views
    var checkDiff = function(sec_ago, expected_brief, expected_ext) {
      check(brief_view, timestamp - sec_ago * 1000, expected_brief);
      check(ext_view, timestamp - sec_ago * 1000, expected_ext);
    };

    // Helper to check an absolute TS for an exact match against both views
    var checkAbs = function(ts, expected_brief, expected_ext) {
      if (!expected_ext) {
        expected_ext = expected_brief;
      }
      check(brief_view, ts, expected_brief);
      check(ext_view, ts, expected_ext);
    };

    // Helper to check an absolute TS for a match at the beginning against
    var checkStartsWith = function(view, ts, expected) {
      var result = view.getRelativeTimeSpanString(ts);
      var regexp = new RegExp('^' + expected);
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
    var last_month = moment()
        .subtract(1, 'month')
        .date(3),
      months = [
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
      ],
      day_of_month = new Date().getDate();
    check(brief_view, last_month, months[last_month.month()] + ' 3');
    checkStartsWith(ext_view, last_month, months[last_month.month()] + ' 3');

    // subtract 26 hours to be safe in case of DST stuff
    var yesterday = new Date(timestamp - 26 * 60 * 60 * 1000),
      days_of_week = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    check(brief_view, yesterday, days_of_week[yesterday.getDay()]);
    checkStartsWith(ext_view, yesterday, days_of_week[yesterday.getDay()]);

    // Check something long ago
    // months are zero-indexed in JS for some reason
    check(brief_view, new Date(2012, 4, 5, 17, 30, 0), 'May 5, 2012');
    checkStartsWith(ext_view, new Date(2012, 4, 5, 17, 30, 0), 'May 5, 2012');
  });

  describe('updates within a minute reasonable intervals', function() {
    var view;
    beforeEach(function() {
      view = new Whisper.TimestampView();
    });
    afterEach(function() {
      clearTimeout(view.timeout);
    });

    it('updates timestamps this minute within a minute', function() {
      var now = Date.now();
      view.$el.attr('data-timestamp', now - 1000);
      view.update();
      assert.isAbove(view.delay, 0); // non zero
      assert.isBelow(view.delay, 60 * 1000); // < minute
    });

    it('updates timestamps from this hour within a minute', function() {
      var now = Date.now();
      view.$el.attr('data-timestamp', now - 1000 - 1000 * 60 * 5); // 5 minutes and 1 sec ago
      view.update();
      assert.isAbove(view.delay, 0); // non zero
      assert.isBelow(view.delay, 60 * 1000); // minute
    });

    it('updates timestamps from today within an hour', function() {
      var now = Date.now();
      view.$el.attr('data-timestamp', now - 1000 - 1000 * 60 * 60 * 5); // 5 hours and 1 sec ago
      view.update();
      assert.isAbove(view.delay, 60 * 1000); // minute
      assert.isBelow(view.delay, 60 * 60 * 1000); // hour
    });

    it('updates timestamps from this week within a day', function() {
      var now = Date.now();
      view.$el.attr('data-timestamp', now - 1000 - 6 * 24 * 60 * 60 * 1000); // 6 days and 1 sec ago
      view.update();
      assert.isAbove(view.delay, 60 * 60 * 1000); // hour
      assert.isBelow(view.delay, 24 * 60 * 60 * 1000); // day
    });

    it('does not updates very old timestamps', function() {
      var now = Date.now();
      // return falsey value for long ago dates that don't update
      view.$el.attr('data-timestamp', now - 8 * 24 * 60 * 60 * 1000);
      view.update();
      assert.notOk(view.delay);
    });
  });
});
