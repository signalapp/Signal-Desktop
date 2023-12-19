// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';
import got from 'got';
import FormData from 'form-data';
import * as util from 'util';
import * as zlib from 'zlib';

import * as durations from '../../util/durations';
import { upload } from '../../logging/uploadDebugLog';
import * as logger from '../../logging/log';

const gzip: (_: zlib.InputType) => Promise<Buffer> = util.promisify(zlib.gzip);

describe('upload', () => {
  beforeEach(function (this: Mocha.Context) {
    this.sandbox = sinon.createSandbox();

    this.sandbox.stub(process, 'platform').get(() => 'freebsd');

    this.fakeGet = this.sandbox.stub(got, 'get');
    this.fakePost = this.sandbox.stub(got, 'post');

    this.fakeGet.resolves({
      body: {
        fields: {
          foo: 'bar',
          key: 'abc123',
        },
        url: 'https://example.com/fake-upload',
      },
    });
    this.fakePost.resolves({ statusCode: 204 });
  });

  afterEach(function (this: Mocha.Context) {
    this.sandbox.restore();
  });

  it('makes a request to get the S3 bucket, then uploads it there', async function (this: Mocha.Context) {
    assert.strictEqual(
      await upload({ content: 'hello world', appVersion: '1.2.3', logger }),
      'https://debuglogs.org/abc123.gz'
    );

    sinon.assert.calledOnce(this.fakeGet);
    sinon.assert.calledWith(this.fakeGet, 'https://debuglogs.org/', {
      responseType: 'json',
      headers: { 'User-Agent': 'Signal-Desktop/1.2.3' },
      timeout: { request: durations.MINUTE },
    });

    const compressedContent = await gzip('hello world');

    sinon.assert.calledOnce(this.fakePost);
    sinon.assert.calledWith(this.fakePost, 'https://example.com/fake-upload', {
      headers: { 'User-Agent': 'Signal-Desktop/1.2.3' },
      timeout: { request: durations.MINUTE },
      body: sinon.match((value: unknown) => {
        if (!(value instanceof FormData)) {
          return false;
        }

        // `FormData` doesn't offer high-level APIs for fetching data, so we do this.
        const buffer = value.getBuffer();
        assert(
          buffer.includes(compressedContent),
          'gzipped content was not in body'
        );

        return true;
      }, 'FormData'),
    });
  });

  it("rejects if we can't get a token", async function (this: Mocha.Context) {
    this.fakeGet.rejects(new Error('HTTP request failure'));

    let err: unknown;
    try {
      await upload({ content: 'hello world', appVersion: '1.2.3', logger });
    } catch (e) {
      err = e;
    }
    assert.instanceOf(err, Error);
  });

  it('rejects with an invalid token body', async function (this: Mocha.Context) {
    const bodies = [
      null,
      {},
      { fields: {} },
      { fields: { nokey: 'ok' } },
      { fields: { key: '123' } },
      { fields: { key: '123' }, url: { not: 'a string' } },
      { fields: { key: '123' }, url: 'http://notsecure.example.com' },
      { fields: { key: '123' }, url: 'not a valid URL' },
    ];

    for (const body of bodies) {
      this.fakeGet.resolves({ body });

      let err: unknown;
      try {
        // Again, these should be run serially.
        // eslint-disable-next-line no-await-in-loop
        await upload({ content: 'hello world', appVersion: '1.2.3', logger });
      } catch (e) {
        err = e;
      }
      assert.instanceOf(err, Error);
    }
  });

  it("rejects if the upload doesn't return a 204", async function (this: Mocha.Context) {
    this.fakePost.resolves({ statusCode: 400 });

    let err: unknown;
    try {
      await upload({ content: 'hello world', appVersion: '1.2.3', logger });
    } catch (e) {
      err = e;
    }
    assert.instanceOf(err, Error);
  });
});
