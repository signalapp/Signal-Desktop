const path = require('path');

module.exports = {
  entry: './ts/webworker/workers/node/util/util.worker.ts',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
    fallback: {
      crypto: require.resolve('crypto-browserify'),
      path: require.resolve('path-browserify'),
      fs: false,
      stream: require.resolve('stream-browserify'),
    },
  },
  output: {
    filename: 'util.worker.js',
    path: path.resolve(__dirname, 'ts', 'webworker', 'workers', 'node', 'util'),
  },
  target: 'webworker',
};
