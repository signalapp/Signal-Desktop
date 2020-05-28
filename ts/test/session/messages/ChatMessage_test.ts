import { expect } from 'chai';

import { ChatMessage, Quote, Preview, AttachmentPointer } from '../../../session/messages/outgoing';
import { SignalService } from '../../../protobuf';
import { TextEncoder } from 'util';

describe('ChatMessage', () => {
    it('can create empty message with just a timestamp', () => {
        const message = new ChatMessage({
            timestamp: Date.now(),
        });
        const plainText = message.plainTextBuffer();
        const decoded = SignalService.Content.toObject(SignalService.Content.decode(plainText));
        expect(decoded).to.have.deep.property('dataMessage', {});
    });

    it('can create message with a body', () => {
        const message = new ChatMessage({
            timestamp: Date.now(),
            body: 'body',
        });
        const plainText = message.plainTextBuffer();
        const decoded = SignalService.Content.toObject(SignalService.Content.decode(plainText));
        expect(decoded.dataMessage).to.have.deep.property('body', 'body');
    });

    it('can create message with a expire timer', () => {
        const message = new ChatMessage({
            timestamp: Date.now(),
            expireTimer: 3600,
        });
        const plainText = message.plainTextBuffer();
        const decoded = SignalService.Content.toObject(SignalService.Content.decode(plainText));
        expect(decoded.dataMessage).to.have.deep.property('expireTimer', 3600);
    });

    it('can create message with a full loki profile', () => {
        const profileKey = new TextEncoder().encode('profileKey');

        const lokiProfile = {
            displayName: 'displayName',
            avatarPointer: 'avatarPointer',
            profileKey,
        };
        const message = new ChatMessage({
            timestamp: Date.now(),
            lokiProfile: lokiProfile,
        });
        const plainText = message.plainTextBuffer();
        const decoded = SignalService.Content.toObject(SignalService.Content.decode(plainText));
        expect(decoded.dataMessage.profile).to.have.deep.property('displayName', 'displayName');
        expect(decoded.dataMessage.profile).to.have.deep.property('avatar', 'avatarPointer');
        expect(decoded.dataMessage).to.have.deep.property('profileKey', profileKey);
    });

    it('can create message with a quote without attachments', () => {
        let quote: Quote;

        quote = { id: 1234, author: 'author', text: 'text' };
        const message = new ChatMessage({
            timestamp: Date.now(),
            quote,
        });
        const plainText = message.plainTextBuffer();
        const decoded = SignalService.Content.toObject(SignalService.Content.decode(plainText));
        const id = decoded.dataMessage.quote.id.toNumber();
        expect(id).to.be.deep.equal(1234);
        expect(decoded.dataMessage.quote).to.have.deep.property('author', 'author');
        expect(decoded.dataMessage.quote).to.have.deep.property('text', 'text');
    });

    it('can create message with a preview', () => {
        let preview: Preview;

        preview = { url: 'url', title: 'title' };
        const previews = new Array<Preview>();
        previews.push(preview);

        const message = new ChatMessage({
            timestamp: Date.now(),
            preview: previews,
        });
        const plainText = message.plainTextBuffer();
        const decoded = SignalService.Content.toObject(SignalService.Content.decode(plainText));
        expect(decoded.dataMessage.preview).to.have.lengthOf(1);
        expect(decoded.dataMessage.preview[0]).to.have.deep.property('url', 'url');
        expect(decoded.dataMessage.preview[0]).to.have.deep.property('title', 'title');
    });


    it('can create message with an AttachmentPointer', () => {
        let attachment: AttachmentPointer;

        attachment = { url: 'url', contentType: 'contentType', id: 1234 };
        const attachments = new Array<AttachmentPointer>();
        attachments.push(attachment);

        const message = new ChatMessage({
            timestamp: Date.now(),
            attachments: attachments,
        });
        const plainText = message.plainTextBuffer();
        const decoded = SignalService.Content.toObject(SignalService.Content.decode(plainText));
        expect(decoded.dataMessage.attachments).to.have.lengthOf(1);
        expect(decoded.dataMessage.attachments[0]).to.have.deep.property('url', 'url');
        const id = decoded.dataMessage.attachments[0].id.toNumber();
        expect(id).to.be.equal(1234);
        expect(decoded.dataMessage.attachments[0]).to.have.deep.property('contentType', 'contentType');
    });

    it('ttl of 1 day', () => {
        const message = new ChatMessage({
            timestamp: Date.now(),
        });
        expect(message.ttl()).to.equal(24 * 60 * 60 * 1000);
    });

    it('has an identifier', () => {
        const message = new ChatMessage({
            timestamp: Date.now(),
        });
        expect(message.identifier).to.not.equal(null,  'identifier cannot be null');
        expect(message.identifier).to.not.equal(undefined,  'identifier cannot be undefined');
    });
});
