require('./metro-pet-image-reader.cjs')();
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const config = require('expo/metro-config').getDefaultConfig(path.resolve(__dirname, '..'));
const worker = require(config.transformerPath);
module.exports = {
  ...worker,
  getCacheKey(...args) {
    return createHash('sha256').update(worker.getCacheKey(...args)).update(fs.readFileSync(__filename))
      .update(fs.readFileSync(require.resolve('./metro-pet-image-reader.cjs'))).digest('hex');
  },
};
