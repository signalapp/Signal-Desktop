/*
 * vim: ts=4:sw=4:expandtab
 */
'use strict';

describe('TimestampView', function() {
    it('formats long-ago timestamps correctly', function() {
        var timestamp = Date.now();
        var brief_view = new Whisper.BriefTimestampView().render(),
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
            var regexp = new RegExp("^" + expected);
            assert.match(result, regexp);
        };

        // check integer timestamp, JS Date object and moment object
        checkAbs(timestamp, 'now', 'a few seconds ago');
        checkAbs(new Date(), 'now', 'a few seconds ago');
        checkAbs(moment(), 'now', 'a few seconds ago');

        // check recent timestamps
        checkDiff(30, 'now', 'a few seconds ago'); // 30 seconds
        checkDiff(50, '1 min', 'a minute ago'); // >= 45 seconds => 1 minute
        checkDiff(40*60, '40 min', '40 minutes ago');
        checkDiff(60*60, '1 hour', 'an hour ago');
        checkDiff(125*60, '2 hours', '2 hours ago');

        // set to third of month to avoid problems on the 29th/30th/31st
        var last_month = moment().subtract(1, 'month').date(3),
            months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            day_of_month = new Date().getDate();
        check(brief_view,last_month, months[last_month.month()] + ' 3');
        checkStartsWith(ext_view,last_month, months[last_month.month()] + ' 3');

        // subtract 26 hours to be safe in case of DST stuff
        var yesterday = new Date(timestamp - 26*60*60*1000),
            days_of_week = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        check(brief_view, yesterday, days_of_week[yesterday.getDay()]);
        checkStartsWith(ext_view, yesterday, days_of_week[yesterday.getDay()]);

        // Check something long ago
        // months are zero-indexed in JS for some reason
        check(brief_view, new Date(2012, 4, 5, 17, 30, 0), 'May 5, 2012');
        checkStartsWith(ext_view, new Date(2012, 4, 5, 17, 30, 0), 'May 5, 2012');
    });


    it('updates at reasonable intervals', function() {
        var view = new Whisper.TimestampView();
        assert.isBelow(view.computeDelay(1000), 60 * 1000); // < minute
        assert.strictEqual(view.computeDelay(1000 * 60 * 5), 60 * 1000); // minute
        assert.strictEqual(view.computeDelay(1000 * 60 * 60 * 5), 60 * 60 * 1000); // hour

        assert.isBelow(view.computeDelay(6 * 24 * 60 * 60 * 1000), 7 * 24 * 60 * 60 * 1000); // < week

        // return falsey value for long ago dates that don't update
        assert.notOk(view.computeDelay(1000 * 60 * 60 * 24 * 8));

    });

});
