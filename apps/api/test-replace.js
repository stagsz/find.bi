import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '..', '.env') });

let publicKey = process.env.JWT_PUBLIC_KEY;

console.log('BEFORE replacement:');
console.log('Char 26:', publicKey.charCodeAt(26), '=', publicKey[26]);
console.log('Char 27:', publicKey.charCodeAt(27), '=', publicKey[27]);
console.log('Substring 26-28:', JSON.stringify(publicKey.substring(26, 28)));

// Try the replacement
publicKey = publicKey.replace(/\\n/g, '\n');

console.log('\nAFTER replacement:');
console.log('Char 26:', publicKey.charCodeAt(26), '=', publicKey[26]);
console.log('Is newline?:', publicKey.charCodeAt(26) === 10);
console.log('First 60 chars:', JSON.stringify(publicKey.substring(0, 60)));

// Show what the PEM should look like
console.log('\n\nProper PEM format should have actual newlines:');
console.log(publicKey.substring(0, 100));
