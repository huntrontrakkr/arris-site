/* Seal a transmission, and the frames it carries, for a hidden page. One key
 * is derived from the access code (PBKDF2-SHA-256); the message and each
 * attached file are encrypted with it (AES-GCM, an IV each). The message
 * also carries the attachments' names, captions and IVs, so the repository
 * holds only ciphertext and numbered blobs (base64 text, which any host
 * serves), and reading the page's source gives nothing away.
 * kapa/index.html opens it with the same derivation.
 * Keep the plaintexts and their codes out of the repository.
 *
 * usage: node tools/seal.mjs CODE OUTDIR MESSAGE.txt [FILE "CAPTION"] ...
 *        writes OUTDIR/sealed.json and OUTDIR/sealed/1.txt, 2.txt, ...
 *        (CODE is compared as upper-case letters and digits only) */
import { webcrypto as crypto } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, extname } from 'node:path';

const [codeArg, outDir, messagePath, ...rest] = process.argv.slice(2);
const code = (codeArg || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
if (!code || !outDir || !messagePath || rest.length % 2) {
  console.error('usage: node tools/seal.mjs CODE OUTDIR MESSAGE.txt [FILE "CAPTION"] ...'); process.exit(2);
}
const ITER = 250000;
const salt = crypto.getRandomValues(new Uint8Array(16));
const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(code), 'PBKDF2', false, ['deriveKey']);
const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITER }, base,
  { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
const b64 = a => Buffer.from(a).toString('base64');
async function seal(bytes) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  return { iv: b64(iv), ct: new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes)) };
}

const blobs = join(outDir, 'sealed');
rmSync(blobs, { recursive: true, force: true });
mkdirSync(blobs, { recursive: true });
const TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
const files = [];
for (let i = 0; i < rest.length; i += 2) {
  const { iv, ct } = await seal(readFileSync(rest[i]));
  const file = `${files.length + 1}.txt`;
  writeFileSync(join(blobs, file), b64(ct) + '\n');
  files.push({ file: `sealed/${file}`, iv, type: TYPES[extname(rest[i]).toLowerCase()] || 'application/octet-stream', caption: rest[i + 1] });
}
const message = JSON.stringify({ text: readFileSync(messagePath, 'utf8'), files });
const { iv, ct } = await seal(new TextEncoder().encode(message));
writeFileSync(join(outDir, 'sealed.json'), JSON.stringify({ iter: ITER, salt: b64(salt), iv, ct: b64(ct) }) + '\n');
console.error(`sealed ${files.length} file(s) into ${outDir}`);
