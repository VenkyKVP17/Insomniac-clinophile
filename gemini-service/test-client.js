/**
 * Test client for Gemini Encasement Service
 */

const API_KEY = process.env.GEMINI_SERVICE_API_KEY || 'gemini-service-secret-key-change-this-in-production';
const BASE_URL = process.env.GEMINI_SERVICE_URL || 'http://localhost:3500';

async function testHealthCheck() {
  console.log('\n📊 Testing health check...');
  const response = await fetch(`${BASE_URL}/health`);
  const data = await response.json();
  console.log('Health:', data);
  return data.status === 'ok';
}

async function testSimpleInference() {
  console.log('\n🤖 Testing simple inference...');
  const response = await fetch(`${BASE_URL}/api/infer`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: 'What is 2+2? Answer in one word.',
      temperature: 0.7,
    }),
  });

  const data = await response.json();
  console.log('Response:', data);
  return data.success;
}

async function testChatCompletion() {
  console.log('\n💬 Testing chat completion (OpenAI format)...');
  const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gemini-2.0-flash-exp',
      messages: [
        { role: 'user', content: 'Tell me a short joke about programming.' },
      ],
      temperature: 0.9,
      max_tokens: 100,
    }),
  });

  const data = await response.json();
  console.log('Response:', JSON.stringify(data, null, 2));
  return data.choices?.[0]?.message?.content;
}

async function testStats() {
  console.log('\n📈 Testing statistics...');
  const response = await fetch(`${BASE_URL}/api/stats`, {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
    },
  });

  const data = await response.json();
  console.log('Stats:', data);
  return true;
}

async function runAllTests() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║     GEMINI ENCASEMENT SERVICE - TEST SUITE           ║');
  console.log('╚═══════════════════════════════════════════════════════╝');

  try {
    await testHealthCheck();
    await testSimpleInference();
    await testChatCompletion();
    await testStats();

    console.log('\n✅ All tests passed!\n');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

runAllTests();
