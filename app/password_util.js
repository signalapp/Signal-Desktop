const { sha512 } = require('js-sha512');

const generateHash = (phrase) => sha512(phrase);
const matchesHash = (phrase, hash) => sha512(phrase) === hash;

module.exports = {
    generateHash,
    matchesHash,
};