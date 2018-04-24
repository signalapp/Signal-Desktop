exports.isJPEG = mimeType =>
  mimeType === 'image/jpeg';

exports.isVideo = mimeType =>
  mimeType.startsWith('video/') && mimeType !== 'video/wmv';

exports.isImage = mimeType =>
  mimeType.startsWith('image/') && mimeType !== 'image/tiff';

exports.isAudio = mimeType => mimeType.startsWith('audio/');
