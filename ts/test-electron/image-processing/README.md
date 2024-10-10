# Image processing

`handleImageAttachment` is the core function here, but in practice the code path includes downscaling.

This process is part of `enqueueMessageForSend` (`ts/models/conversations.ts`):

```ts
// ...

/**
 * At this point, all attachments have been processed and written to disk as draft
 * attachments, via processAttachments. All transcodable images have been re-encoded
 * via canvas to remove EXIF data. Images above the high-quality threshold size have
 * been scaled to high-quality JPEGs.
 *
 * If we choose to send images in standard quality, we need to scale them down
 * (potentially for the second time). When we do so, we also delete the current
 * draft attachment on disk for cleanup.
 *
 * All draft attachments (with a path or just in-memory) will be written to disk for
 * real in `upgradeMessageSchema`.
 */
if (!sendHQImages) {
  attachmentsToSend = await Promise.all(
    attachmentsToSend.map(async attachment => {
      const downscaledAttachment = await downscaleOutgoingAttachment(
        attachment
      );
      if (downscaledAttachment !== attachment && attachment.path) {
        drop(deleteAttachmentData(attachment.path));
      }
      return downscaledAttachment;
    })
  );
}

//...
```

So for more realistic tests, we are exercising this as well.

`enqueueMessageForSend` does a great deal else which makes it impractical to test directly, so we're duplicating.
