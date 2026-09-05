const crypto = require('crypto');
function base64url(b) {
  return b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
const k = crypto.generateKeyPairSync('ec', {
  namedCurve: 'prime256v1',
  publicKeyEncoding: { type: 'spki', format: 'der' },
  privateKeyEncoding: { type: 'pkcs8', format: 'der' }
});
const pub = base64url(k.publicKey.slice(26));
const priv = base64url(k.privateKey.slice(36, 68));
const fs = require('fs');
fs.writeFileSync('vapid_keys.json', JSON.stringify({ publicKey: pub, privateKey: priv }, null, 2));
console.log("Keys written to vapid_keys.json");
