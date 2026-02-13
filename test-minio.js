/**
 * Test MinIO connection and bucket setup
 */

import * as Minio from 'minio';
import dotenv from 'dotenv';

dotenv.config();

const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000', 10),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ROOT_USER || 'minioadmin',
  secretKey: process.env.MINIO_ROOT_PASSWORD || 'minioadmin',
});

const bucketName = process.env.MINIO_BUCKET || 'hazop-documents';

async function testMinio() {
  try {
    console.log('Testing MinIO connection...');
    console.log(`Endpoint: ${process.env.MINIO_ENDPOINT || 'localhost'}:${process.env.MINIO_PORT || '9000'}`);
    console.log(`Bucket: ${bucketName}`);

    // List all buckets
    const buckets = await minioClient.listBuckets();
    console.log('\n✓ Connected to MinIO successfully!');
    console.log('\nExisting buckets:');
    buckets.forEach(bucket => {
      console.log(`  - ${bucket.name} (created: ${bucket.creationDate})`);
    });

    // Check if our bucket exists
    const bucketExists = await minioClient.bucketExists(bucketName);
    if (bucketExists) {
      console.log(`\n✓ Bucket '${bucketName}' exists`);

      // List objects in the bucket
      console.log('\nFiles in bucket:');
      const stream = minioClient.listObjects(bucketName, '', true);
      let fileCount = 0;

      stream.on('data', obj => {
        fileCount++;
        console.log(`  ${fileCount}. ${obj.name} (${(obj.size / 1024).toFixed(2)} KB)`);
      });

      stream.on('error', err => {
        console.error('Error listing objects:', err);
      });

      stream.on('end', () => {
        if (fileCount === 0) {
          console.log('  (no files)');
        }
        console.log(`\nTotal files: ${fileCount}`);
      });

    } else {
      console.log(`\n⚠ Bucket '${bucketName}' does not exist. Creating it...`);
      await minioClient.makeBucket(bucketName);
      console.log(`✓ Bucket '${bucketName}' created successfully`);
    }

  } catch (error) {
    console.error('\n✗ MinIO test failed:');
    console.error(error.message);
    if (error.code) {
      console.error(`Error code: ${error.code}`);
    }
    process.exit(1);
  }
}

testMinio();
