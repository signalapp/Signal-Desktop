import { expect } from 'chai';

import { OpenGroupMessage } from '../../../session/messages/outgoing';
import { AttachmentType } from '../../../types/Attachment';
import * as MIME from '../../../../ts/types/MIME';
import { QuotedAttachmentType } from '../../../components/conversation/Quote';

describe('OpenGroupMessage', () => {
    it('can create empty message with just a timestamp and server', () => {
        const message = new OpenGroupMessage({
            timestamp: Date.now(),
            server: 'server',
        });
        expect(message).to.have.property('timestamp').to.be.approximately(Date.now(), 10);
        expect(message).to.have.deep.property('server', 'server');
    });

    it('can create message with a body', () => {
        const message = new OpenGroupMessage({
            timestamp: Date.now(),
            server: 'server',
            body: 'body',
        });
        expect(message).to.have.deep.property('body', 'body');
    });

    it('can create message with a expire timer', () => {
        const message = new OpenGroupMessage({
            timestamp: Date.now(),
            server: 'server',
            body: 'body',
        });
        expect(message).to.have.deep.property('body', 'body');
    });

    it('can create message with a quote', () => {
        let quote: QuotedAttachmentType;

        quote = {
            contentType: MIME.IMAGE_JPEG,
            fileName: 'fileName',
            isVoiceMessage: false,
        };
        const message = new OpenGroupMessage({
            timestamp: Date.now(),
            server: 'server',
            quote,
        });
        expect(message?.quote).to.have.property('contentType', MIME.IMAGE_JPEG);
        expect(message?.quote).to.have.deep.property('fileName', 'fileName');
        expect(message?.quote).to.have.deep.property('isVoiceMessage', false);
    });


    it('can create message with an attachment', () => {
        let attachment: AttachmentType;

        attachment = {
            url: 'url',
            caption: 'caption',
            fileName: 'fileName',
            contentType: MIME.AUDIO_AAC,
        };
        const attachments = new Array<AttachmentType>();
        attachments.push(attachment);

        const message =  new OpenGroupMessage({
            timestamp: Date.now(),
            server: 'server',
            attachments: attachments,
        });
        expect(message?.attachments).to.have.lengthOf(1);
        expect(message).to.have.nested.property('attachments[0].caption').to.have.be.deep.equal('caption');
        expect(message).to.have.nested.property('attachments[0].fileName').to.have.be.deep.equal('fileName');
        expect(message).to.have.nested.property('attachments[0].contentType').to.be.deep.equal(MIME.AUDIO_AAC);
        expect(message).to.have.nested.property('attachments[0].url').to.be.deep.equal('url');
    });


    it('has an identifier', () => {
        const message = new OpenGroupMessage({
            timestamp: Date.now(),
            server: 'server',
        });
        expect(message.identifier).to.not.equal(null,  'identifier cannot be null');
        expect(message.identifier).to.not.equal(undefined,  'identifier cannot be undefined');
    });
});
