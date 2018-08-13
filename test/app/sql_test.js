const tmp = require('tmp');
const assert = require('chai').assert;

const Sql = require('../../app/sql');

describe('Sql', () => {
    let tempRootDirectory = null;
    let data = { 'conversationId': 'convoId',
		 'expires_at': 1234,
		 'hasAttachments': 1,
		 'hasFileAttachments': 1,
		 'hasVisualMediaAttachments': 1,
		 'received_at': 123456,
		 'schemaVersion': 3,
		 'sent_at': 1234567,
		 'source': 'rer',
		 'sourceDevice': 'notMy',
		 'type': 0,
		 'unread': 0,
		 'expireTimer': 9876,
		 'expirationStartTimestamp': 00000
	       };
    before(async () => {
	tempRootDirectory = await tmp.dirSync().name;
	let options = { 'configDir': tempRootDirectory, 'key': '6bf14d77dabbe92dab5c29bcd613b2ed241197da328bb2471f0b7c7167cc1d61' };
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
	let media = await Sql.getMessagesWithVisualMediaAttachments('convoId',
								    { limit: 1 });
	assert.strictEqual(media.length, 1);
    });

    it('getMessagesWithFileAttachments', async () => {
	let id = await Sql.saveMessage(data);
	let file = await Sql.getMessagesWithFileAttachments('convoId',
							     {
								 limit: 1
							     });
	assert.strictEqual(file.length, 1);
    });

    it('removeAll', async () => {
	await Sql.saveMessage(data);
	await Sql.removeAll();
	let count = await Sql.getMessageCount();
	assert.strictEqual(count, 0);
    });

    it('saveUnprocessed', async () => {
	let unprocessedData = { id: 'identifier', 'timestamp': 12345 };
	let id = await Sql.saveUnprocessed(unprocessedData, { forceSave: 1 });
	assert.strictEqual(id, 'identifier');
	unprocessedData.timestamp = 987654;
	id = await Sql.saveUnprocessed(unprocessedData);
	assert.strictEqual(id, 'identifier');
    });
});
