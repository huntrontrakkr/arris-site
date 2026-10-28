/* Seal a transmission for the hidden pages: the text is encrypted with a
 * key derived from its access code (PBKDF2-SHA-256, then AES-GCM), so only
 * the ciphertext is in the repository and reading the page's source gives
 * nothing away. kapa/index.html opens it with the same derivation. Keep the
 * plaintexts and their codes out of the repository.
 *
 * usage: node tools/seal.mjs CODE < transmission.txt > kapa/sealed.json
 *        (CODE is compared as upper-case letters and digits only) */
import { webcrypto as crypto } from 'node:crypto';

const code = (process.argv[2] || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
if (!code) { console.error('usage: node tools/seal.mjs CODE < text > sealed.json'); process.exit(2); }
const chunks = [];
for await (const c of process.stdin) chunks.push(c);
const text = Buffer.concat(chunks).toString('utf8');

const ITER = 250000;
const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(code), 'PBKDF2', false, ['deriveKey']);
const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITER }, base,
  { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text)));
const b64 = a => Buffer.from(a).toString('base64');
console.log(JSON.stringify({ iter: ITER, salt: b64(salt), iv: b64(iv), ct: b64(ct) }));
