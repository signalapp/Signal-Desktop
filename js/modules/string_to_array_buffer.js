exports.stringToArrayBuffer = string => {
  if (typeof string !== 'string') {
    throw new TypeError("'string' must be a string");
  }

  const array = new Uint8Array(string.length);
  for (let i = 0; i < string.length; i += 1) {
    array[i] = string.charCodeAt(i);
  }
  return array.buffer;
};
