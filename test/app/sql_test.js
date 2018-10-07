const tmp = require('tmp');
const {assert} = require('chai');

const Sql = require('../../app/sql');

describe('Sql', () => {
  let tempRootDirectory = null;
  const data = {
    conversationId: 'identifier',
    expires_at: 1234,
    hasAttachments: 1,
    hasFileAttachments: 1,
    hasVisualMediaAttachments: 1,
    received_at: 123456,
    schemaVersion: null,
    sent_at: 1234567,
    source: 'src',
    sourceDevice: 'dev',
    type: 0,
    unread: 0,
    expireTimer: 9876,
    expirationStartTimestamp: 3248,
  };
  before(async () => {
    tempRootDirectory = await tmp.dirSync().name;
    const options = { configDir: tempRootDirectory, key: '010203098' };
    await Sql.initialize(options);
  });

  after(async () => {
    await Sql.close();
    await Sql.removeDB();
  });

  it('saveMessage', async () => {
    const count1 = await Sql.getMessageCount();
    await Sql.saveMessage(data);
    const count2 = await Sql.getMessageCount();
    assert.strictEqual(count2 - count1, 1);
    const data2 = Object.assign({}, data);
    data2.id = 'modified';
    await Sql.saveMessage(data2, { forceSave: 0 });
    const count3 = await Sql.getMessageCount();
    assert.strictEqual(count3, count2);
  });

  it('removeMessage', async () => {
    const count1 = await Sql.getMessageCount();
    const id = await Sql.saveMessage(data);
    await Sql.removeMessage(id);
    const count2 = await Sql.getMessageCount();
    assert.strictEqual(count2, count1);
  });

  it('getMessageById', async () => {
    const id = await Sql.saveMessage(data);
    const data2 = await Sql.getMessageById(id);
    assert.strictEqual(data2.conversationId, data.conversationId);
    assert.strictEqual(data2.expires_at, data.expires_at);
    assert.strictEqual(data2.received_at, data.received_at);
    assert.strictEqual(data2.type, data.type);
    assert.strictEqual(data2.unread, data.unread);
  });

  it('getMessagesWithVisualMediaAttachments', async () => {
    await Sql.saveMessage(data);
    const media = await Sql.getMessagesWithVisualMediaAttachments('identifier', {
      limit: 1,
    });
    assert.strictEqual(media.length, 1);
  });

  it('getMessagesWithFileAttachments', async () => {
    await Sql.saveMessage(data);
    const file = await Sql.getMessagesWithFileAttachments('identifier', {
      limit: 1,
    });
    assert.strictEqual(file.length, 1);
  });

  it('removeAll', async () => {
    await Sql.saveMessage(data);
    await Sql.removeAll();
    const count = await Sql.getMessageCount();
    assert.strictEqual(count, 0);
  });

  it('getAllUnprocessed', async () => {
    const unprocessedData = { id: 'unproc', timestamp: 12345 };
    let id = await Sql.saveUnprocessed(unprocessedData, { forceSave: 1 });
    assert.strictEqual(id, 'unproc');
    unprocessedData.timestamp = 987654;

    id = await Sql.saveUnprocessed(unprocessedData);
    assert.strictEqual(id, 'unproc');
    const fromDb = await Sql.getAllUnprocessed();
    assert.strictEqual(fromDb.length, 1);
  });

  it('getMessagesNeedingUpgrade', async () => {
    await Sql.saveMessage(data);
    let result = await Sql.getMessagesNeedingUpgrade(1, { maxVersion: 0 });
    assert.notEqual(result, null);
    assert.strictEqual(result.length, 1);

    const data2 = Object.assign({}, data);
    data2.schemaVersion = 2;
    await Sql.saveMessage(data2);
    result = await Sql.getMessagesNeedingUpgrade(2, { maxVersion: 3 });
    assert.notEqual(result, null);
    assert.strictEqual(result.length, 2);

    result = await Sql.getMessagesNeedingUpgrade(2, { maxVersion: 2 });
    assert.notEqual(result, null);
    assert.strictEqual(result.length, 1);
  });

  it('removeUnprocessed', async () => {
    const unprocessedData = { id: 'unproc', timestamp: 12345 };
    let id1 = await Sql.saveUnprocessed(unprocessedData, { forceSave: 1 });
    let id2 = await Sql.saveUnprocessed(unprocessedData, { forceSave: 1 });
    const ids = [id1, id2];
    await Sql.removeUnprocessed(ids);
    let fromDb = await Sql.getAllUnprocessed();
    assert.strictEqual(fromDb.length, 0);

    id1 = await Sql.saveUnprocessed(unprocessedData, { forceSave: 1 });
    id2 = await Sql.saveUnprocessed(unprocessedData, { forceSave: 1 });
    await Sql.removeUnprocessed(id1);
    await Sql.removeUnprocessed(id1);
    fromDb = await Sql.getAllUnprocessed();
    assert.strictEqual(fromDb.length, 0);
  });

  it('removeAllUnprocessed', async () => {
    const unprocessedData = { id: 'unproc', timestamp: 12345 };
    await Sql.saveUnprocessed(unprocessedData, { forceSave: 1 });
    await Sql.saveUnprocessed(unprocessedData, { forceSave: 1 });
    await Sql.removeAllUnprocessed();
    const fromDb = await Sql.getAllUnprocessed();
    assert.strictEqual(fromDb.length, 0);
  });
});
