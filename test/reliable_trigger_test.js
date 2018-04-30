'use strict';

describe('ReliableTrigger', function() {
  describe('trigger', function() {
    var Model, model;

    before(function() {
      Model = Backbone.Model;
    });

    beforeEach(function() {
      model = new Model();
    });

    it('returns successfully if this._events is falsey', function() {
      model._events = null;
      model.trigger('click');
    });
    it('handles map of events to trigger', function() {
      var a = 0,
        b = 0;
      model.on('a', function(arg) {
        a = arg;
      });
      model.on('b', function(arg) {
        b = arg;
      });

      model.trigger({
        a: 1,
        b: 2,
      });

      assert.strictEqual(a, 1);
      assert.strictEqual(b, 2);
    });
    it('handles space-separated list of events to trigger', function() {
      var a = false,
        b = false;
      model.on('a', function() {
        a = true;
      });
      model.on('b', function() {
        b = true;
      });

      model.trigger('a b');

      assert.strictEqual(a, true);
      assert.strictEqual(b, true);
    });
    it('calls all clients registered for "all" event', function() {
      var count = 0;
      model.on('all', function() {
        count += 1;
      });

      model.trigger('left');
      model.trigger('right');

      assert.strictEqual(count, 2);
    });
    it('calls all clients registered for target event', function() {
      var a = false,
        b = false;
      model.on('event', function() {
        a = true;
      });
      model.on('event', function() {
        b = true;
      });

      model.trigger('event');

      assert.strictEqual(a, true);
      assert.strictEqual(b, true);
    });
    it('successfully returns and calls all clients even if first failed', function() {
      var a = false,
        b = false;
      model.on('event', function() {
        a = true;
        throw new Error('a is set, but exception is thrown');
      });
      model.on('event', function() {
        b = true;
      });

      model.trigger('event');

      assert.strictEqual(a, true);
      assert.strictEqual(b, true);
    });
    it('calls clients with no args', function() {
      var called = false;
      model.on('event', function() {
        called = true;
      });

      model.trigger('event');

      assert.strictEqual(called, true);
    });
    it('calls clients with 1 arg', function() {
      var args;
      model.on('event', function() {
        args = arguments;
      });

      model.trigger('event', 1);

      assert.strictEqual(args[0], 1);
    });
    it('calls clients with 2 args', function() {
      var args;
      model.on('event', function() {
        args = arguments;
      });

      model.trigger('event', 1, 2);

      assert.strictEqual(args[0], 1);
      assert.strictEqual(args[1], 2);
    });
    it('calls clients with 3 args', function() {
      var args;
      model.on('event', function() {
        args = arguments;
      });

      model.trigger('event', 1, 2, 3);

      assert.strictEqual(args[0], 1);
      assert.strictEqual(args[1], 2);
      assert.strictEqual(args[2], 3);
    });
    it('calls clients with 4+ args', function() {
      var args;
      model.on('event', function() {
        args = arguments;
      });

      model.trigger('event', 1, 2, 3, 4);

      assert.strictEqual(args[0], 1);
      assert.strictEqual(args[1], 2);
      assert.strictEqual(args[2], 3);
      assert.strictEqual(args[3], 4);
    });
  });
});
