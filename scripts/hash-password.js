#!/usr/bin/env node

/**
 * Utility script to generate bcrypt password hashes.
 * Usage: node scripts/hash-password.js <password>
 */

const bcrypt = require('bcrypt');

const password = process.argv[2];

if (!password) {
  console.error('Usage: node scripts/hash-password.js <password>');
  process.exit(1);
}

const saltRounds = 10;

bcrypt.hash(password, saltRounds, (err, hash) => {
  if (err) {
    console.error('Error hashing password:', err);
    process.exit(1);
  }

  console.log('\nBcrypt hash for password:', password);
  console.log('Hash:', hash);
  console.log('\nCopy this hash to your SQL migration or seed file.\n');
});
