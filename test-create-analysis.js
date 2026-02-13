/**
 * Test creating an analysis to see the actual error
 */

import fetch from 'node-fetch';

const API_URL = 'http://localhost:4000';
const JWT_TOKEN = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImFkbWluQGhhem9wLmxvY2FsIiwicm9sZSI6ImFkbWluaXN0cmF0b3IiLCJ0eXBlIjoiYWNjZXNzIiwic3ViIjoiOTMzMTI4MjctZTMyOC00YTIwLTkyYjMtMDliNzQ0MzljZTM0IiwiaWF0IjoxNzcwOTI3NzI2LCJleHAiOjE3NzA5Mjg2MjYsImlzcyI6Imhhem9wLWFzc2lzdGFudCIsImF1ZCI6Imhhem9wLWFwaSJ9.jLLcifjlS7MwtMNIp1DB40dBeUU8A1ltgmOGka3GRqNtWWz7FSISngzZwJdWwZsmjrzqkLu2yVW7S2MZ44oQSeMWL6isUHQ87IWA1U5kK8Bi7QlrwKGLmv0paNiQg9KnfaZdndjsOQPKEurKiy2dzN-s_W1whADflSNkVhHPPujFAJLaa9h98wwqXxeSw2Bf-eEhxtlYQI-DzUJDS_t-8aiFRjAknXXRzjZPbdAqDZPnb-KSYo8ApiZZUq1SLw1BYoVm2jInbAGQqczrNOc-M9kGLH5LJ-3RifjXnTjVHeUJlG4KcBwLHUgU4SWj9eZ0TjKHKd41Y2ubbqp16hvp4Q';

const projectId = 'bc2f1ece-cbb7-4096-aeee-1c427826683d';

async function testCreateAnalysis() {
  try {
    console.log('Testing analysis creation...');
    console.log('Project ID:', projectId);

    // First, get the documents
    const docsResponse = await fetch(`${API_URL}/projects/${projectId}/documents`, {
      headers: {
        'Authorization': `Bearer ${JWT_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    const docsData = await docsResponse.json();
    console.log('\nDocuments:', docsData.data.length);

    if (docsData.data.length === 0) {
      console.log('No documents found!');
      return;
    }

    const documentId = docsData.data[0].id;
    console.log('Using document:', docsData.data[0].filename);
    console.log('Document ID:', documentId);
    console.log('Document status:', docsData.data[0].status);

    // Now try to create an analysis
    console.log('\nCreating analysis...');
    const analysisResponse = await fetch(`${API_URL}/projects/${projectId}/analyses`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${JWT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Test Analysis',
        documentId: documentId,
      }),
    });

    const analysisData = await analysisResponse.json();

    if (!analysisResponse.ok) {
      console.log('\n✗ Analysis creation failed!');
      console.log('Status:', analysisResponse.status);
      console.log('Response:', JSON.stringify(analysisData, null, 2));
    } else {
      console.log('\n✓ Analysis created successfully!');
      console.log('Analysis ID:', analysisData.data.analysis.id);
      console.log('Analysis name:', analysisData.data.analysis.name);
    }

  } catch (error) {
    console.error('\n✗ Error:', error.message);
  }
}

testCreateAnalysis();
