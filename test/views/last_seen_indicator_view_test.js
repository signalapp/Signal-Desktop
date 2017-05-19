/*
 * vim: ts=4:sw=4:expandtab
 */
describe('LastSeenIndicatorView', function() {
    // TODO: in electron branch, where we have access to real i18n, test rendered HTML

    it('renders provided count', function() {
        var view = new Whisper.LastSeenIndicatorView({count: 10});
        assert.equal(view.count, 10);
    });

    it('increments count', function() {
        var view = new Whisper.LastSeenIndicatorView({count: 4});
        assert.equal(view.count, 4);
        view.increment(3);
        assert.equal(view.count, 7);
    });
});
