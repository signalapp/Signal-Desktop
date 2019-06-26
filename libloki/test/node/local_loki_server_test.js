const axios = require('axios');
const { assert } = require('chai');
const LocalLokiServer = require('../../modules/local_loki_server');

describe('LocalLokiServer', () => {
  before(async () => {
    this.server = new LocalLokiServer();
    await this.server.start(8000);
  });

  after(() => {
    this.server.close();
  });

  it('should return 405 if not a POST request', async () => {
    try {
      await axios.get('http://localhost:8000');
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
      await axios.post('http://localhost:8000', { name: 'Test' });
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
      await axios.post('http://localhost:8000/invalid', { name: 'Test' });
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
      const server = new LocalLokiServer();
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
        await axios.post('http://localhost:8001/storage_rpc/v1', messageData);
      } catch (error) {
        assert.isNotOk(error, 'Error occured');
      }

      return promise;
    });
  });
});
