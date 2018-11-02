/* global Backbone */

'use strict';

describe('ReliableTrigger', () => {
  describe('trigger', () => {
    let Model;
    let model;

    before(() => {
      ({ Model } = Backbone);
    });

    beforeEach(() => {
      model = new Model();
    });

    it('returns successfully if this._events is falsey', () => {
      model._events = null;
      model.trigger('click');
    });
    it('handles map of events to trigger', () => {
      let a = 0;
      let b = 0;

      model.on('a', arg => {
        a = arg;
      });
      model.on('b', arg => {
        b = arg;
      });

      model.trigger({
        a: 1,
        b: 2,
      });

      assert.strictEqual(a, 1);
      assert.strictEqual(b, 2);
    });
    it('handles space-separated list of events to trigger', () => {
      let a = false;
      let b = false;

      model.on('a', () => {
        a = true;
      });
      model.on('b', () => {
        b = true;
      });

      model.trigger('a b');

      assert.strictEqual(a, true);
      assert.strictEqual(b, true);
    });
    it('calls all clients registered for "all" event', () => {
      let count = 0;
      model.on('all', () => {
        count += 1;
      });

      model.trigger('left');
      model.trigger('right');

      assert.strictEqual(count, 2);
    });
    it('calls all clients registered for target event', () => {
      let a = false;
      let b = false;

      model.on('event', () => {
        a = true;
      });
      model.on('event', () => {
        b = true;
      });

      model.trigger('event');

      assert.strictEqual(a, true);
      assert.strictEqual(b, true);
    });
    it('successfully returns and calls all clients even if first failed', () => {
      let a = false;
      let b = false;

      model.on('event', () => {
        a = true;
        throw new Error('a is set, but exception is thrown');
      });
      model.on('event', () => {
        b = true;
      });

      model.trigger('event');

      assert.strictEqual(a, true);
      assert.strictEqual(b, true);
    });
    it('calls clients with no args', () => {
      let called = false;
      model.on('event', () => {
        called = true;
      });

      model.trigger('event');

      assert.strictEqual(called, true);
    });
    it('calls clients with 1 arg', () => {
      let args;
      model.on('event', (...eventArgs) => {
        args = eventArgs;
      });

      model.trigger('event', 1);

      assert.strictEqual(args[0], 1);
    });
    it('calls clients with 2 args', () => {
      let args;
      model.on('event', (...eventArgs) => {
        args = eventArgs;
      });

      model.trigger('event', 1, 2);

      assert.strictEqual(args[0], 1);
      assert.strictEqual(args[1], 2);
    });
    it('calls clients with 3 args', () => {
      let args;
      model.on('event', (...eventArgs) => {
        args = eventArgs;
      });

      model.trigger('event', 1, 2, 3);

      assert.strictEqual(args[0], 1);
      assert.strictEqual(args[1], 2);
      assert.strictEqual(args[2], 3);
    });
    it('calls clients with 4+ args', () => {
      let args;
      model.on('event', (...eventArgs) => {
        args = eventArgs;
      });

      model.trigger('event', 1, 2, 3, 4);

      assert.strictEqual(args[0], 1);
      assert.strictEqual(args[1], 2);
      assert.strictEqual(args[2], 3);
      assert.strictEqual(args[3], 4);
    });
  });
});
