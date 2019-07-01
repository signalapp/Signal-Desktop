const axios = require('axios');
const { assert } = require('chai');
const LocalLokiServer = require('../../modules/local_loki_server');
const selfsigned = require('selfsigned');
const https = require('https');

class HolePunchingError extends Error {
  constructor(message, err) {
    super(message);
    this.name = 'HolePunchingError';
    this.error = err;
  }
}

describe('LocalLokiServer', () => {
  before(async () => {
    const attrs = [{ name: 'commonName', value: 'mypubkey' }];
    const pems = selfsigned.generate(attrs, { days: 365 * 10 });
    global.textsecure = {};
    global.textsecure.HolePunchingError = HolePunchingError;
    this.server = new LocalLokiServer(pems, { skipUpnp: true });
    await this.server.start(8000);
    this.axiosClient = axios.create({
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
      }),
    });
  });

  after(async () => {
    await this.server.close();
  });

  it('should return 405 if not a POST request', async () => {
    try {
      await this.axiosClient.get('https://localhost:8000');
      assert.fail('Got a successful response');
    } catch (error) {
      if (error.response) {
        assert.equal(405, error.response.status);
        return;
      }
      assert.isNotOk(error, 'Another error was receieved');
    }
  });

  it('should return 404 if no endpoint provided', async () => {
    try {
      await this.axiosClient.post('https://localhost:8000', { name: 'Test' });
      assert.fail('Got a successful response');
    } catch (error) {
      if (error.response) {
        assert.equal(404, error.response.status);
        return;
      }
      assert.isNotOk(error, 'Another error was receieved');
    }
  });

  it('should return 404 and a string if invalid enpoint is provided', async () => {
    try {
      await this.axiosClient.post('https://localhost:8000/invalid', { name: 'Test' });
      assert.fail('Got a successful response');
    } catch (error) {
      if (error.response) {
        assert.equal(404, error.response.status);
        assert.equal('Invalid endpoint!', error.response.data);
        return;
      }
      assert.isNotOk(error, 'Another error was receieved');
    }
  });

  describe('/store', async () => {
    it('should pass the POSTed data to the callback', async () => {
      const attrs = [{ name: 'commonName', value: 'mypubkey' }];
      const pems = selfsigned.generate(attrs, { days: 365 * 10 });
      const server = new LocalLokiServer(pems, { skipUpnp: true });
      await server.start(8001);
      const messageData = {
        method: 'store',
        params: {
          data: 'This is data',
        },
      };

      const promise = new Promise(res => {
        server.on('message', eventData => {
          const { message, onSuccess } = eventData;
          assert.equal(message, 'This is data');
          onSuccess();
          server.close();
          res();
        });
      });

      try {
        await this.axiosClient.post('https://localhost:8001/storage_rpc/v1', messageData);
      } catch (error) {
        assert.isNotOk(error, 'Error occured');
      }

      return promise;
    });
  });
});
