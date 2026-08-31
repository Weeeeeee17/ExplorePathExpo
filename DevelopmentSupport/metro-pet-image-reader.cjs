// SDK54's image-size path reader stops at512KiB. Some original JPGs have
// large metadata before their frame header. Read only our bounded pet files
// fully, preserving every source byte (including content credentials).
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
module.exports = function installPetImageReader() {
  const metroRequire = createRequire(require.resolve('metro/private/Assets'));
  const moduleId = metroRequire.resolve('image-size');
  metroRequire('image-size');
  // Patch the JPEG handler object, not require.cache: Expo's supervising worker
  // may have captured the image-size function before loading our worker.
  // This is specific to the locked SDK54 image-size1.x layout and is tested.
  const handler = require(path.join(path.dirname(moduleId), 'types/index.js')).typeHandlers.jpg;
  if (handler.explorePathFullPetRead) return;
  const original = handler.calculate;
  const petRoot = path.resolve(__dirname, '../assets/pets') + path.sep;
  handler.calculate = function calculate(input, filepath) {
    if (typeof filepath !== 'string' || !path.resolve(filepath).startsWith(petRoot) || !/\.(jpg|jpeg)$/i.test(filepath)) return original(input, filepath);
    if (fs.statSync(filepath).size > 8 * 1024 * 1024) throw new Error('Pet artwork exceeds the bounded 8MiB metadata reader');
    return original(fs.readFileSync(filepath), filepath);
  };
  handler.explorePathFullPetRead = true;
};
