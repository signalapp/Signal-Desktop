const { isArrayBuffer, isFunction, isUndefined, omit } = require('lodash');

// type Context :: {
//   writeNewAttachmentData :: ArrayBuffer -> Promise (IO Path)
// }
//
//      migrateDataToFileSystem :: Attachment ->
//                                 Context ->
//                                 Promise Attachment
exports.migrateDataToFileSystem = async (
  attachment,
  { writeNewAttachmentData } = {}
) => {
  if (!isFunction(writeNewAttachmentData)) {
    throw new TypeError("'writeNewAttachmentData' must be a function");
  }

  const { data } = attachment;
  const hasData = !isUndefined(data);
  const shouldSkipSchemaUpgrade = !hasData;
  if (shouldSkipSchemaUpgrade) {
    console.log('WARNING: `attachment.data` is `undefined`');
    return attachment;
  }

  const isValidData = isArrayBuffer(data);
  if (!isValidData) {
    throw new TypeError(
      'Expected `attachment.data` to be an array buffer;' +
        ` got: ${typeof attachment.data}`
    );
  }

  const path = await writeNewAttachmentData(data);

  const attachmentWithoutData = omit(Object.assign({}, attachment, { path }), [
    'data',
  ]);
  return attachmentWithoutData;
};
