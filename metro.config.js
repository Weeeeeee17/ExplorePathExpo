require('./DevelopmentSupport/metro-pet-image-reader.cjs')();
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
config.transformerPath = require.resolve('./DevelopmentSupport/metro-worker.cjs');
module.exports = config;
