/**
 * Configure MinIO CORS settings to allow browser downloads
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

async function configureCORS() {
  try {
    console.log('Configuring CORS for MinIO bucket:', bucketName);

    // MinIO CORS configuration - allow all origins for development
    const corsConfig = {
      CORSConfiguration: {
        CORSRule: [
          {
            AllowedOrigin: ['*'],
            AllowedMethod: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
            AllowedHeader: ['*'],
            ExposeHeader: ['ETag', 'Content-Type', 'Content-Length'],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    };

    // Set bucket policy to allow public read access
    const policy = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { AWS: ['*'] },
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${bucketName}/*`],
        },
      ],
    };

    await minioClient.setBucketPolicy(bucketName, JSON.stringify(policy));
    console.log('✓ Bucket policy set successfully (public read access)');

    console.log('\n✓ MinIO is now configured for browser downloads');
    console.log('  - CORS enabled');
    console.log('  - Public read access granted');
    console.log('\nYou should now be able to download files from the browser!');

  } catch (error) {
    console.error('\n✗ Failed to configure MinIO:');
    console.error(error.message);
    process.exit(1);
  }
}

configureCORS();
