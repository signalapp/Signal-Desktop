// /* global textsecure, Whisper */

// 'use strict';
// FIXME audric enable back those test
describe('ConversationCollection', () => {
  //   textsecure.messaging = true;
  //   before(clearDatabase);
  //   after(clearDatabase);
  //   it('should be ordered newest to oldest', () => {
  //     const conversations = new window.models.Conversation.ConversationCollection();
  //     // Timestamps
  //     const today = new Date();
  //     const tomorrow = new Date();
  //     tomorrow.setDate(today.getDate() + 1);
  //     // Add convos
  //     conversations.add({ active_at: today });
  //     conversations.add({ active_at: tomorrow });
  //     const { models } = conversations;
  //     const firstTimestamp = models[0].get('active_at').getTime();
  //     const secondTimestamp = models[1].get('active_at').getTime();
  //     // Compare timestamps
  //     assert(firstTimestamp > secondTimestamp);
  //   });
  // });
  // describe('Conversation', () => {
  //   const attributes = {
  //     type: 'private',
  //     id: '051d11d01e56d9bfc3d74115c33225a632321b509ac17a13fdeac71165d09b94ab',
  //   };
  //   before(async () => {
  //     const convo = new window.models.Conversation.ConversationCollection().add(attributes);
  //     await window.Signal.Data.saveConversation(convo.attributes, {
  //       Conversation: window.models.Conversation.ConversationModel,
  //     });
  //     // const message = convo.messageCollection.add({
  //     //   body: 'hello world',
  //     //   conversationId: convo.id,
  //     //   type: 'outgoing',
  //     //   sent_at: Date.now(),
  //     //   received_at: Date.now(),
  //     // });
  //     // await message.commit(false);
  //   });
  //   after(clearDatabase);
  //   it('contains its own messages', async () => {
  //     const convo = new window.models.Conversation.ConversationCollection().add({
  //       id: '051d11d01e56d9bfc3d74115c33225a632321b509ac17a13fdeac71165d09b94ab',
  //     });
  //     await convo.fetchMessages();
  //     assert.notEqual(convo.messageCollection.length, 0);
  //   });
  //   it('contains only its own messages', async () => {
  //     const convo = new window.models.Conversation.ConversationCollection().add({
  //       id: '052d11d01e56d9bfc3d74115c33225a632321b509ac17a13fdeac71165d09b94ab',
  //     });
  //     await convo.fetchMessages();
  //     assert.strictEqual(convo.messageCollection.length, 0);
  //   });
  //   it('adds conversation to message collection upon leaving group', async () => {
  //     const convo = new window.models.Conversation.ConversationCollection().add({
  //       type: 'group',
  //       id: '052d11d01e56d9bfc3d74115c33225a632321b509ac17a13fdeac71165d09b94ab',
  //     });
  //     await convo.leaveClosedGroup();
  //     assert.notEqual(convo.messageCollection.length, 0);
  //   });
  //   it('has a title', () => {
  //     const convos = new window.models.Conversation.ConversationCollection();
  //     let convo = convos.add(attributes);
  //     assert.equal(
  //       convo.getTitle(),
  //       '051d11d01e56d9bfc3d74115c33225a632321b509ac17a13fdeac71165d09b94ab'
  //     );
  //     convo = convos.add({ type: '' });
  //     assert.equal(convo.getTitle(), 'Unknown group');
  //     convo = convos.add({ name: 'name' });
  //     assert.equal(convo.getTitle(), 'name');
  //   });
  //   it('returns the number', () => {
  //     const convos = new window.models.Conversation.ConversationCollection();
  //     let convo = convos.add(attributes);
  //     assert.equal(
  //       convo.getNumber(),
  //       '051d11d01e56d9bfc3d74115c33225a632321b509ac17a13fdeac71165d09b94ab'
  //     );
  //     convo = convos.add({ type: '' });
  //     assert.equal(convo.getNumber(), '');
  //   });
  //   describe('when set to private', () => {
  //     it('correctly validates hex numbers', () => {
  //       const regularId = new window.models.Conversation.ConversationModel({
  //         type: 'private',
  //         id:
  //           '051d11d01e56d9bfc3d74115c33225a632321b509ac17a13fdeac71165d09b94ab',
  //       });
  //       const invalidId = new window.models.Conversation.ConversationModel({
  //         type: 'private',
  //         id:
  //           'j71d11d01e56d9bfc3d74115c33225a632321b509ac17a13fdeac71165d09b94ab',
  //       });
  //       assert.ok(regularId.isValid());
  //       assert.notOk(invalidId.isValid());
  //     });
  //     it('correctly validates length', () => {
  //       const regularId33 = new window.models.Conversation.ConversationModel({
  //         type: 'private',
  //         id:
  //           '051d11d01e56d9bfc3d74115c33225a632321b509ac17a13fdeac71165d09b94ab',
  //       });
  //       const regularId32 = new window.models.Conversation.ConversationModel({
  //         type: 'private',
  //         id: '1d11d01e56d9bfc3d74115c33225a632321b509ac17a13fdeac71165d09b94ab',
  //       });
  //       const shortId = new window.models.Conversation.ConversationModel({
  //         type: 'private',
  //         id: '771d11d',
  //       });
  //       const longId = new window.models.Conversation.ConversationModel({
  //         type: 'private',
  //         id:
  //           '771d11d01e56d9bfc3d74115c33225a632321b509ac17a13fdeac71165d09b94abaa',
  //       });
  //       assert.ok(regularId33.isValid());
  //       assert.ok(regularId32.isValid());
  //       assert.notOk(shortId.isValid());
  //       assert.notOk(longId.isValid());
  //     });
  //   });
});
