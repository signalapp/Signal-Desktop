// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// We allow `any`s because it's arduous to set up "real" WebAPIs and storages.
/* eslint-disable @typescript-eslint/no-explicit-any */

import { assert } from 'chai';
import * as sinon from 'sinon';
import { v4 as uuid } from 'uuid';
import Long from 'long';
import * as durations from '../../util/durations';
import { drop } from '../../util/drop';
import * as Bytes from '../../Bytes';
import { SenderCertificateMode } from '../../textsecure/OutgoingMessage';
import { SignalService as Proto } from '../../protobuf';

import { SenderCertificateService } from '../../services/senderCertificate';

import SenderCertificate = Proto.SenderCertificate;

describe('SenderCertificateService', () => {
  const FIFTEEN_MINUTES = 15 * durations.MINUTE;

  let fakeValidCertificate: SenderCertificate;
  let fakeValidEncodedCertificate: Uint8Array;
  let fakeValidCertificateExpiry: number;
  let fakeServer: any;
  let fakeEvents: Pick<typeof window.Whisper.events, 'on' | 'off'>;
  let fakeStorage: any;

  function initializeTestService(): SenderCertificateService {
    const result = new SenderCertificateService();
    result.initialize({
      server: fakeServer,
      events: fakeEvents,
      storage: fakeStorage,
    });
    return result;
  }

  beforeEach(() => {
    fakeValidCertificate = new SenderCertificate();
    fakeValidCertificateExpiry = Date.now() + 604800000;
    const certificate = new SenderCertificate.Certificate();
    certificate.expires = Long.fromNumber(fakeValidCertificateExpiry);
    fakeValidCertificate.certificate =
      SenderCertificate.Certificate.encode(certificate).finish();
    fakeValidEncodedCertificate =
      SenderCertificate.encode(fakeValidCertificate).finish();

    fakeServer = {
      isOnline: () => true,
      getSenderCertificate: sinon.stub().resolves({
        certificate: Bytes.toBase64(fakeValidEncodedCertificate),
      }),
    };

    fakeEvents = {
      on: sinon.stub(),
      off: sinon.stub(),
    } as unknown as typeof fakeEvents;

    fakeStorage = {
      get: sinon.stub(),
      put: sinon.stub().resolves(),
      remove: sinon.stub().resolves(),
    };
    fakeStorage.get.withArgs('uuid_id').returns(`${uuid()}.2`);
    fakeStorage.get.withArgs('password').returns('abc123');
  });

  describe('get', () => {
    it('returns valid yes-E164 certificates from storage if they exist', async () => {
      const cert = {
        expires: Date.now() + 123456,
        serialized: new Uint8Array(2),
      };
      fakeStorage.get.withArgs('senderCertificate').returns(cert);

      const service = initializeTestService();

      assert.strictEqual(
        await service.get(SenderCertificateMode.WithE164),
        cert
      );

      sinon.assert.notCalled(fakeStorage.put);
    });

    it('returns valid no-E164 certificates from storage if they exist', async () => {
      const cert = {
        expires: Date.now() + 123456,
        serialized: new Uint8Array(2),
      };
      fakeStorage.get.withArgs('senderCertificateNoE164').returns(cert);

      const service = initializeTestService();

      assert.strictEqual(
        await service.get(SenderCertificateMode.WithoutE164),
        cert
      );

      sinon.assert.notCalled(fakeStorage.put);
    });

    it('returns and stores a newly-fetched yes-E164 certificate if none was in storage', async () => {
      const service = initializeTestService();

      assert.deepEqual(await service.get(SenderCertificateMode.WithE164), {
        expires: fakeValidCertificateExpiry - FIFTEEN_MINUTES,
        serialized: fakeValidEncodedCertificate,
      });

      sinon.assert.calledWithMatch(fakeStorage.put, 'senderCertificate', {
        expires: fakeValidCertificateExpiry - FIFTEEN_MINUTES,
        serialized: Buffer.from(fakeValidEncodedCertificate),
      });

      sinon.assert.calledWith(fakeServer.getSenderCertificate, false);
    });

    it('returns and stores a newly-fetched no-E164 certificate if none was in storage', async () => {
      const service = initializeTestService();

      assert.deepEqual(await service.get(SenderCertificateMode.WithoutE164), {
        expires: fakeValidCertificateExpiry - FIFTEEN_MINUTES,
        serialized: fakeValidEncodedCertificate,
      });

      sinon.assert.calledWithMatch(fakeStorage.put, 'senderCertificateNoE164', {
        expires: fakeValidCertificateExpiry - FIFTEEN_MINUTES,
        serialized: Buffer.from(fakeValidEncodedCertificate),
      });

      sinon.assert.calledWith(fakeServer.getSenderCertificate, true);
    });

    it('fetches new certificates if the value in storage has already expired', async () => {
      const service = initializeTestService();

      fakeStorage.get.withArgs('senderCertificate').returns({
        expires: Date.now() - 1000,
        serialized: new Uint8Array(2),
      });

      await service.get(SenderCertificateMode.WithE164);

      sinon.assert.called(fakeServer.getSenderCertificate);
    });

    it('fetches new certificates if the value in storage is invalid', async () => {
      const service = initializeTestService();

      fakeStorage.get.withArgs('senderCertificate').returns({
        serialized: 'not an uint8array',
      });

      await service.get(SenderCertificateMode.WithE164);

      sinon.assert.called(fakeServer.getSenderCertificate);
    });

    it('only hits the server once per certificate type when requesting many times', async () => {
      const service = initializeTestService();

      await Promise.all([
        service.get(SenderCertificateMode.WithE164),
        service.get(SenderCertificateMode.WithoutE164),
        service.get(SenderCertificateMode.WithE164),
        service.get(SenderCertificateMode.WithoutE164),
        service.get(SenderCertificateMode.WithE164),
        service.get(SenderCertificateMode.WithoutE164),
        service.get(SenderCertificateMode.WithE164),
        service.get(SenderCertificateMode.WithoutE164),
      ]);

      sinon.assert.calledTwice(fakeServer.getSenderCertificate);
    });

    it('hits the server again after a request has completed', async () => {
      const service = initializeTestService();

      await service.get(SenderCertificateMode.WithE164);
      sinon.assert.calledOnce(fakeServer.getSenderCertificate);
      await service.get(SenderCertificateMode.WithE164);

      sinon.assert.calledTwice(fakeServer.getSenderCertificate);
    });

    it('returns undefined if the request to the server fails', async () => {
      const service = initializeTestService();

      fakeServer.getSenderCertificate.rejects(new Error('uh oh'));

      assert.isUndefined(await service.get(SenderCertificateMode.WithE164));
    });

    it('returns undefined if the server returns an already-expired certificate', async () => {
      const service = initializeTestService();

      const expiredCertificate = new SenderCertificate();
      const certificate = new SenderCertificate.Certificate();
      certificate.expires = Long.fromNumber(Date.now() - 1000);
      expiredCertificate.certificate =
        SenderCertificate.Certificate.encode(certificate).finish();
      fakeServer.getSenderCertificate.resolves({
        certificate: Bytes.toBase64(
          SenderCertificate.encode(expiredCertificate).finish()
        ),
      });

      assert.isUndefined(await service.get(SenderCertificateMode.WithE164));
    });

    it('clear waits for any outstanding requests then erases storage', async () => {
      let count = 0;

      fakeServer = {
        isOnline: () => true,
        getSenderCertificate: sinon.spy(async () => {
          await new Promise(resolve => setTimeout(resolve, 500));

          count += 1;
          return {
            certificate: Bytes.toBase64(fakeValidEncodedCertificate),
          };
        }),
      };

      const service = initializeTestService();

      drop(service.get(SenderCertificateMode.WithE164));
      drop(service.get(SenderCertificateMode.WithoutE164));

      await service.clear();

      assert.equal(count, 2);

      assert.isUndefined(fakeStorage.get('senderCertificate'));
      assert.isUndefined(fakeStorage.get('senderCertificateNoE164'));
    });
  });
});
