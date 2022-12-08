const path = require('path');

module.exports = {
  entry: './ts/webworker/workers/node/libsession/libsession.worker.ts',
  node: {
    __dirname: false,
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.node$/,
        loader: 'node-loader',
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
    filename: 'libsession.worker.js',
    path: path.resolve(__dirname, 'ts', 'webworker', 'workers', 'node', 'libsession'),
  },
  target: 'node',
};
