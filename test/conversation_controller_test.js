/* global Whisper */

'use strict';

describe('ConversationController', () => {
  it('sorts conversations based on timestamp then by intl-friendly title', () => {
    const collection = window.getInboxCollection();
    collection.reset([]);

    collection.add(
      new Whisper.Conversation({
        name: 'No timestamp',
      })
    );
    collection.add(
      new Whisper.Conversation({
        name: 'B',
        timestamp: 20,
      })
    );
    collection.add(
      new Whisper.Conversation({
        name: 'C',
        timestamp: 20,
      })
    );
    collection.add(
      new Whisper.Conversation({
        name: 'Á',
        timestamp: 20,
      })
    );
    collection.add(
      new Whisper.Conversation({
        name: 'First!',
        timestamp: 30,
      })
    );

    assert.strictEqual(collection.at('0').get('name'), 'First!');
    assert.strictEqual(collection.at('1').get('name'), 'Á');
    assert.strictEqual(collection.at('2').get('name'), 'B');
    assert.strictEqual(collection.at('3').get('name'), 'C');
    assert.strictEqual(collection.at('4').get('name'), 'No timestamp');

    collection.reset([]);
  });
});
