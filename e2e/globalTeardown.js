const { cleanup } = require('detox/internals');

module.exports = async () => {
  await cleanup();
};
