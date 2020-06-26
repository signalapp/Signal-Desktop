const semver = require('semver');

exports.isBeta = version => semver.parse(version).prerelease[0] === 'beta';
