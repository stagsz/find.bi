import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '..', '.env') });

console.log('Testing JWT key loading...\n');

const privateKey = process.env.JWT_PRIVATE_KEY;
const publicKey = process.env.JWT_PUBLIC_KEY;

console.log('Private key exists:', !!privateKey);
console.log('Public key exists:', !!publicKey);

if (privateKey) {
  console.log('\nPrivate key starts with:', privateKey.substring(0, 50));
  console.log('Private key contains actual newlines:', privateKey.includes('\n'));
  console.log('Private key contains \\n string:', privateKey.includes('\\n'));
}

if (publicKey) {
  console.log('\nPublic key starts with:', publicKey.substring(0, 50));
  console.log('Public key contains actual newlines:', publicKey.includes('\n'));
  console.log('Public key contains \\n string:', publicKey.includes('\\n'));
}

// Try to initialize JWT service
console.log('\nTrying to initialize JWT service...');
try {
  const { getJwtService } = await import('./src/services/jwt.service.js');
  const jwtService = getJwtService();
  await jwtService.initialize();
  console.log('✓ JWT service initialized successfully!');

  // Try to generate a test token
  const tokens = await jwtService.generateTokenPair({
    id: 'test-user-id',
    email: 'test@example.com',
    role: 'viewer'
  });
  console.log('✓ Successfully generated test tokens!');
} catch (error) {
  console.error('✗ JWT initialization failed:', error.message);
}
