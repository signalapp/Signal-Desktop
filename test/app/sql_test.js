const tmp = require('tmp');
const assert = require('chai').assert;

const Sql = require('../../app/sql');

describe('Sql', () => {
    let tempRootDirectory = null;
    let data = { 'conversationId': 'identifier',
		 'expires_at': 1234,
		 'hasAttachments': 1,
		 'hasFileAttachments': 1,
		 'hasVisualMediaAttachments': 1,
		 'received_at': 123456,
		 'schemaVersion': null,
		 'sent_at': 1234567,
		 'source': 'src',
		 'sourceDevice': 'dev',
		 'type': 0,
		 'unread': 0,
		 'expireTimer': 9876,
		 'expirationStartTimestamp': 00000
	       };
    before(async () => {
	tempRootDirectory = await tmp.dirSync().name;
	let options = { 'configDir': tempRootDirectory, 'key': '010203098' };
	await Sql.initialize(options);
    });
    
    after(async () => {
	await Sql.close();
	await Sql.removeDB();
    });
    
    it('saveMessage', async () => {
	let count1 = await Sql.getMessageCount();
	let id = await Sql.saveMessage(data);
	let count2 = await Sql.getMessageCount();
	assert.strictEqual(count2-count1, 1);
	let data2 = Object.assign({}, data);
	data2.id = 'modified';
	let id2 = await Sql.saveMessage(data2, { 'forceSave': 0 });
	let count3 = await Sql.getMessageCount();
	assert.strictEqual(count3, count2);
    });

    it('removeMessage', async () => {
	let count1 = await Sql.getMessageCount();
	let id = await Sql.saveMessage(data);
	await Sql.removeMessage(id);
	let count2 = await Sql.getMessageCount();
	assert.strictEqual(count2, count1);
    });

    it('getMessageById', async () => {
	let id = await Sql.saveMessage(data);
	let data2 = await Sql.getMessageById(id);
	assert.strictEqual(data2.conversationId, data.conversationId);
	assert.strictEqual(data2.expires_at, data.expires_at);
	assert.strictEqual(data2.received_at, data.received_at);
	assert.strictEqual(data2.type, data.type);
	assert.strictEqual(data2.unread, data.unread);
    });

    it('getMessagesWithVisualMediaAttachments', async () => {
	let id = await Sql.saveMessage(data);
	let media = await Sql.getMessagesWithVisualMediaAttachments('identifier',
								    { limit: 1 });
	assert.strictEqual(media.length, 1);
    });

    it('getMessagesWithFileAttachments', async () => {
	let id = await Sql.saveMessage(data);
	let file = await Sql.getMessagesWithFileAttachments('identifier',
							     { limit: 1 });
	assert.strictEqual(file.length, 1);
    });

    it('removeAll', async () => {
	await Sql.saveMessage(data);
	await Sql.removeAll();
	let count = await Sql.getMessageCount();
	assert.strictEqual(count, 0);
    });

    it('getAllUnprocessed', async () => {
	let unprocessedData = { id: 'unproc', 'timestamp': 12345 };
	let id = await Sql.saveUnprocessed(unprocessedData, { forceSave: 1 });
	assert.strictEqual(id, 'unproc');
	unprocessedData.timestamp = 987654;

	id = await Sql.saveUnprocessed(unprocessedData);
	assert.strictEqual(id, 'unproc');
	let fromDb = await Sql.getAllUnprocessed();
	assert.strictEqual(fromDb.length, 1);
    });

    it('getMessagesNeedingUpgrade', async () => {
	await Sql.saveMessage(data);
	let result = await Sql.getMessagesNeedingUpgrade(1, { maxVersion: 0 });
	assert.notEqual(result, null);
	assert.strictEqual(result.length, 1);
	
	let data2 = Object.assign({}, data);
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
	let unprocessedData = { id: 'unproc', 'timestamp': 12345 };
	let id1 = await Sql.saveUnprocessed(unprocessedData, { forceSave: 1 });
	let id2 = await Sql.saveUnprocessed(unprocessedData, { forceSave: 1 });
	let ids = [id1, id2];
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
	let unprocessedData = { id: 'unproc', 'timestamp': 12345 };
	let id1 = await Sql.saveUnprocessed(unprocessedData, { forceSave: 1 });
	let id2 = await Sql.saveUnprocessed(unprocessedData, { forceSave: 1 });
	await Sql.removeAllUnprocessed();
	let fromDb = await Sql.getAllUnprocessed();
	assert.strictEqual(fromDb.length, 0);
    });
});
