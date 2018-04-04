const sinon = require('sinon');
const { assert } = require('chai');

const Startup = require('../../js/modules/startup');


describe('Startup', () => {
  const sandbox = sinon.createSandbox();

  describe('syncReadReceiptConfiguration', () => {
    afterEach(() => {
      sandbox.restore();
    });

    it('should complete if user hasn’t previously synced', async () => {
      const deviceId = '2';
      const sendRequestConfigurationSyncMessage = sandbox.spy();
      const storagePutSpy = sandbox.spy();
      const storage = {
        get(name) {
          if (name !== 'read-receipt-configuration-sync') {
            return true;
          }

          return false;
        },
        put: storagePutSpy,
      };

      const expected = {
        status: 'complete',
      };

      const actual = await Startup.syncReadReceiptConfiguration({
        deviceId,
        sendRequestConfigurationSyncMessage,
        storage,
      });

      assert.deepEqual(actual, expected);
      assert.equal(sendRequestConfigurationSyncMessage.callCount, 1);
      assert.equal(storagePutSpy.callCount, 1);
      assert(storagePutSpy.calledWith('read-receipt-configuration-sync', true));
    });

    it('should be skipped if this is the primary device', async () => {
      const deviceId = '1';
      const sendRequestConfigurationSyncMessage = () => {};
      const storage = {};

      const expected = {
        status: 'skipped',
        reason: 'isPrimaryDevice',
      };

      const actual = await Startup.syncReadReceiptConfiguration({
        deviceId,
        sendRequestConfigurationSyncMessage,
        storage,
      });

      assert.deepEqual(actual, expected);
    });

    it('should be skipped if user has previously synced', async () => {
      const deviceId = '2';
      const sendRequestConfigurationSyncMessage = () => {};
      const storage = {
        get(name) {
          if (name !== 'read-receipt-configuration-sync') {
            return false;
          }

          return true;
        },
      };

      const expected = {
        status: 'skipped',
        reason: 'hasPreviouslySynced',
      };

      const actual = await Startup.syncReadReceiptConfiguration({
        deviceId,
        sendRequestConfigurationSyncMessage,
        storage,
      });

      assert.deepEqual(actual, expected);
    });

    it('should return error if sending of sync request fails', async () => {
      const deviceId = '2';

      const sendRequestConfigurationSyncMessage = sandbox.stub();
      sendRequestConfigurationSyncMessage.rejects(new Error('boom'));

      const storagePutSpy = sandbox.spy();
      const storage = {
        get(name) {
          if (name !== 'read-receipt-configuration-sync') {
            return true;
          }

          return false;
        },
        put: storagePutSpy,
      };

      const actual = await Startup.syncReadReceiptConfiguration({
        deviceId,
        sendRequestConfigurationSyncMessage,
        storage,
      });

      assert.equal(actual.status, 'error');
      assert.include(actual.error, 'boom');

      assert.equal(sendRequestConfigurationSyncMessage.callCount, 1);
      assert.equal(storagePutSpy.callCount, 0);
    });
  });
});
