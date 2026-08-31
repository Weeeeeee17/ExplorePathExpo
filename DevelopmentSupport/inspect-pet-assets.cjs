const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const size = require('image-size');
const root = path.resolve(__dirname, '..');
const images = [];
for (const series of fs.readdirSync(path.join(root, 'assets/pets'))) {
  for (const name of fs.readdirSync(path.join(root, 'assets/pets', series))) {
    const file = path.join(root, 'assets/pets', series, name), bytes = fs.readFileSync(file);
    let limitedRead = true;
    try { size(file); } catch { limitedRead = false; }
    images.push({ path: `assets/pets/${series}/${name}`, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), ...size(bytes), limitedRead });
  }
}
if (images.length !== 20) throw new Error('Expected 20 supplied images');
console.log(JSON.stringify(images, null, 2));
if (process.argv.includes('--config')) console.log(require('expo/metro-config').getDefaultConfig(root).transformerPath);
