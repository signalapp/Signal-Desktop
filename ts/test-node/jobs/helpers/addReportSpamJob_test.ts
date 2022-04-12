// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as sinon from 'sinon';
import { getDefaultConversation } from '../../../test-both/helpers/getDefaultConversation';
import { Job } from '../../../jobs/Job';

import { addReportSpamJob } from '../../../jobs/helpers/addReportSpamJob';

describe('addReportSpamJob', () => {
  let getMessageServerGuidsForSpam: sinon.SinonStub;
  let jobQueue: { add: sinon.SinonStub };

  beforeEach(() => {
    getMessageServerGuidsForSpam = sinon.stub().resolves(['abc', 'xyz']);
    jobQueue = {
      add: sinon
        .stub()
        .callsFake(
          async data =>
            new Job<unknown>(
              'fake-job-id',
              Date.now(),
              'fake job queue type',
              data,
              Promise.resolve()
            )
        ),
    };
  });

  it('does nothing if the conversation lacks a UUID', async () => {
    await addReportSpamJob({
      conversation: getDefaultConversation({ uuid: undefined }),
      getMessageServerGuidsForSpam,
      jobQueue,
    });

    sinon.assert.notCalled(getMessageServerGuidsForSpam);
    sinon.assert.notCalled(jobQueue.add);
  });

  it("doesn't enqueue a job if there are no messages with server GUIDs", async () => {
    getMessageServerGuidsForSpam.resolves([]);

    await addReportSpamJob({
      conversation: getDefaultConversation(),
      getMessageServerGuidsForSpam,
      jobQueue,
    });

    sinon.assert.notCalled(jobQueue.add);
  });

  it('enqueues a job', async () => {
    const conversation = getDefaultConversation();

    await addReportSpamJob({
      conversation,
      getMessageServerGuidsForSpam,
      jobQueue,
    });

    sinon.assert.calledOnce(getMessageServerGuidsForSpam);
    sinon.assert.calledWith(getMessageServerGuidsForSpam, conversation.id);

    sinon.assert.calledOnce(jobQueue.add);
    sinon.assert.calledWith(jobQueue.add, {
      uuid: conversation.uuid,
      serverGuids: ['abc', 'xyz'],
    });
  });
});
