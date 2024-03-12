// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import * as sinon from 'sinon';
import { Job } from '../../../jobs/Job';
import { addReportSpamJob } from '../../../jobs/helpers/addReportSpamJob';
import type { ConversationType } from '../../../state/ducks/conversations';
import { getDefaultConversation } from '../../../test-both/helpers/getDefaultConversation';

describe('addReportSpamJob', () => {
  let getMessageServerGuidsForSpam: sinon.SinonStub;
  let jobQueue: { add: sinon.SinonStub };

  const conversation: ConversationType = getDefaultConversation();

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

  it('does nothing if the conversation lacks a serviceId', async () => {
    await addReportSpamJob({
      conversation: {
        ...conversation,
        serviceId: undefined,
      },
      getMessageServerGuidsForSpam,
      jobQueue,
    });

    sinon.assert.notCalled(getMessageServerGuidsForSpam);
    sinon.assert.notCalled(jobQueue.add);
  });

  it("doesn't enqueue a job if there are no messages with server GUIDs", async () => {
    getMessageServerGuidsForSpam.resolves([]);

    await addReportSpamJob({
      conversation,
      getMessageServerGuidsForSpam,
      jobQueue,
    });

    sinon.assert.notCalled(jobQueue.add);
  });

  it('enqueues a job without a token', async () => {
    await addReportSpamJob({
      conversation,
      getMessageServerGuidsForSpam,
      jobQueue,
    });

    sinon.assert.calledOnce(getMessageServerGuidsForSpam);
    sinon.assert.calledWith(getMessageServerGuidsForSpam, conversation.id);

    sinon.assert.calledOnce(jobQueue.add);
    sinon.assert.calledWith(jobQueue.add, {
      aci: conversation.serviceId,
      serverGuids: ['abc', 'xyz'],
      token: undefined,
    });
  });

  it('enqueues a job with a token', async () => {
    await addReportSpamJob({
      conversation: {
        ...conversation,
        reportingToken: 'uvw',
      },
      getMessageServerGuidsForSpam,
      jobQueue,
    });

    sinon.assert.calledOnce(getMessageServerGuidsForSpam);
    sinon.assert.calledWith(getMessageServerGuidsForSpam, conversation.id);

    sinon.assert.calledOnce(jobQueue.add);
    sinon.assert.calledWith(jobQueue.add, {
      aci: conversation.serviceId,
      serverGuids: ['abc', 'xyz'],
      token: 'uvw',
    });
  });
});
