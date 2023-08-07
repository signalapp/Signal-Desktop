/* eslint-disable no-await-in-loop */
/* eslint-disable no-unused-expressions */
import chai, { expect } from 'chai';
import Sinon, { useFakeTimers } from 'sinon';
import { noop } from 'lodash';
import chaiAsPromised from 'chai-as-promised';

import { Reactions } from '../../../../util/reactions';
import { Data } from '../../../../data/data';
import * as Storage from '../../../../util/storage';
import { generateFakeIncomingPrivateMessage, stubWindowLog } from '../../../test-utils/utils';
import { DEFAULT_RECENT_REACTS } from '../../../../session/constants';

import { UserUtils } from '../../../../session/utils';
import { SignalService } from '../../../../protobuf';
import { MessageCollection } from '../../../../models/message';

chai.use(chaiAsPromised as any);

describe('ReactionMessage', () => {
  stubWindowLog();

  let clock: Sinon.SinonFakeTimers;
  const ourNumber = '0123456789abcdef';
  const originalMessage = generateFakeIncomingPrivateMessage();
  originalMessage.set('sent_at', Date.now());

  beforeEach(() => {
    Sinon.stub(originalMessage, 'getConversation').returns({
      hasReactions: () => true,
      sendReaction: noop,
    } as any);

    // sendMessageReaction stubs
    Sinon.stub(Data, 'getMessageById').resolves(originalMessage);
    Sinon.stub(Storage, 'getRecentReactions').returns(DEFAULT_RECENT_REACTS);
    Sinon.stub(Storage, 'saveRecentReations').resolves();
    Sinon.stub(UserUtils, 'getOurPubKeyStrFromCache').returns(ourNumber);

    // handleMessageReaction stubs
    Sinon.stub(Data, 'getMessagesBySentAt').resolves(new MessageCollection([originalMessage]));
    Sinon.stub(originalMessage, 'commit').resolves();
  });

  it('can react to a message', async () => {
    // Send reaction
    const reaction = await Reactions.sendMessageReaction(originalMessage.get('id'), '😄');

    expect(reaction?.id, 'id should match the original message timestamp').to.be.equal(
      Number(originalMessage.get('sent_at'))
    );
    expect(reaction?.author, 'author should match the original message author').to.be.equal(
      originalMessage.get('source')
    );
    expect(reaction?.emoji, 'emoji should be 😄').to.be.equal('😄');
    expect(reaction?.action, 'action should be 0').to.be.equal(0);

    // Handling reaction
    const updatedMessage = await Reactions.handleMessageReaction({
      reaction: reaction as SignalService.DataMessage.IReaction,
      sender: ourNumber,
      you: true,
    });

    expect(updatedMessage?.get('reacts'), 'original message should have reacts').to.not.be
      .undefined;

    expect(updatedMessage?.get('reacts')!['😄'], 'reacts should have 😄 key').to.not.be.undefined;

    expect(
      updatedMessage!.get('reacts')!['😄'].senders[0],
      'sender pubkey should match'
    ).to.be.equal(ourNumber);
    expect(updatedMessage!.get('reacts')!['😄'].count, 'count should be 1').to.be.equal(1);
  });

  it('can remove a reaction from a message', async () => {
    // Send reaction
    const reaction = await Reactions.sendMessageReaction(originalMessage.get('id'), '😄');

    expect(reaction?.id, 'id should match the original message timestamp').to.be.equal(
      Number(originalMessage.get('sent_at'))
    );
    expect(reaction?.author, 'author should match the original message author').to.be.equal(
      originalMessage.get('source')
    );
    expect(reaction?.emoji, 'emoji should be 😄').to.be.equal('😄');
    expect(reaction?.action, 'action should be 1').to.be.equal(1);

    // Handling reaction
    const updatedMessage = await Reactions.handleMessageReaction({
      reaction: reaction as SignalService.DataMessage.IReaction,
      sender: ourNumber,
      you: true,
    });

    expect(updatedMessage?.get('reacts'), 'original message reacts should be undefined').to.be
      .undefined;
  });

  it('reactions are rate limited to 20 reactions per minute', async () => {
    // we have already sent 2 messages when this test runs
    for (let i = 0; i < 18; i++) {
      // Send reaction
      await Reactions.sendMessageReaction(originalMessage.get('id'), '👍');
    }

    let reaction = await Reactions.sendMessageReaction(originalMessage.get('id'), '👎');

    expect(reaction, 'no reaction should be returned since we are over the rate limit').to.be
      .undefined;

    clock = useFakeTimers({ now: Date.now(), shouldAdvanceTime: true });

    // Wait a miniute for the rate limit to clear
    clock.tick(1 * 60 * 1000);

    reaction = await Reactions.sendMessageReaction(originalMessage.get('id'), '👋');

    expect(reaction?.id, 'id should match the original message timestamp').to.be.equal(
      Number(originalMessage.get('sent_at'))
    );
    expect(reaction?.author, 'author should match the original message author').to.be.equal(
      originalMessage.get('source')
    );
    expect(reaction?.emoji, 'emoji should be 👋').to.be.equal('👋');
    expect(reaction?.action, 'action should be 0').to.be.equal(0);
    clock.restore();
  });

  afterEach(() => {
    Sinon.restore();
  });
});
