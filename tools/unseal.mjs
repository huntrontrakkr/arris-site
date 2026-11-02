/* Open a sealed page's transmission back into plain files, to change it and
 * seal it again with seal.mjs. The inverse of seal.mjs: the same key from the
 * access code, the message, and each attachment under its own name.
 * Write OUTDIR outside the repository: the plaintexts stay out of it.
 *
 * usage: node tools/unseal.mjs CODE PAGEDIR OUTDIR
 *        reads PAGEDIR/sealed.json and PAGEDIR/sealed/N.txt; writes
 *        OUTDIR/message.txt, OUTDIR/N.<ext> for each attachment, and
 *        OUTDIR/reseal.sh, the seal.mjs command that puts it all back */
import { webcrypto as crypto } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const [codeArg, pageDir, outDir] = process.argv.slice(2);
const code = (codeArg || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
if (!code || !pageDir || !outDir) { console.error('usage: node tools/unseal.mjs CODE PAGEDIR OUTDIR'); process.exit(2); }
const b64 = s => Uint8Array.from(Buffer.from(s, 'base64'));
const sealed = JSON.parse(readFileSync(join(pageDir, 'sealed.json'), 'utf8'));
const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(code), 'PBKDF2', false, ['deriveKey']);
const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: b64(sealed.salt), iterations: sealed.iter }, base,
  { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
const open = async (iv, ct) => new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(iv) }, key, ct));
let msg;
try { msg = JSON.parse(new TextDecoder().decode(await open(sealed.iv, b64(sealed.ct)))); }
catch { console.error('that code does not open it'); process.exit(1); }

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'message.txt'), msg.text);
const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'text/html': '.html' };
const q = s => `'${String(s).replace(/'/g, `'\\''`)}'`;
const args = [];
for (const [i, f] of msg.files.entries()) {
  const name = `${i + 1}${EXT[f.type] || '.bin'}`;
  writeFileSync(join(outDir, name), await open(f.iv, b64(readFileSync(join(pageDir, f.file), 'utf8').trim())));
  args.push(q(join(resolve(outDir), name)), q(f.caption));
}
writeFileSync(join(outDir, 'reseal.sh'),
  `# run from the repository's root, with the code\nnode tools/seal.mjs "$1" ${q(pageDir)} ${q(join(resolve(outDir), 'message.txt'))} \\\n  ${args.join(' ')}\n`);
console.error(`opened the message and ${msg.files.length} file(s) into ${outDir}`);
