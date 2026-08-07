const http = require('http');

const PORT = 5000;
const BASE_URL = `http://localhost:${PORT}`;

// Helper to make HTTP requests
function request(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = `${BASE_URL}${path}`;
    const payload = data ? JSON.stringify(data) : '';
    
    const headers = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const options = {
      method,
      headers,
    };

    const req = http.request(url, options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          resolve({ statusCode: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ statusCode: res.statusCode, body });
        }
      });
    });

    req.on('error', (err) => reject(err));

    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function runTests() {
  console.log('=== STARTING API TESTS ===');
  
  const testUsername = `test_ta_${Math.floor(Math.random() * 10000)}`;
  let token = null;
  let leaveId = null;

  try {
    // 1. Test Register
    console.log('\n[1/5] Testing Registration...');
    const regRes = await request('POST', '/api/auth/register', {
      username: testUsername,
      password: 'password123',
      firstName: 'Test',
      lastName: 'TA',
      startDate: '2026-08-01'
    });

    if (regRes.statusCode === 201 && regRes.body.token) {
      console.log('✓ Registration Success!');
      token = regRes.body.token;
    } else {
      console.error('✗ Registration Failed:', regRes);
      process.exit(1);
    }

    // 2. Test Login
    console.log('\n[2/5] Testing Login...');
    const logRes = await request('POST', '/api/auth/login', {
      username: testUsername,
      password: 'password123'
    });

    if (logRes.statusCode === 200 && logRes.body.token) {
      console.log('✓ Login Success!');
    } else {
      console.error('✗ Login Failed:', logRes);
      process.exit(1);
    }

    // 3. Test Add Leave
    console.log('\n[3/5] Testing Add Leave...');
    const leaveRes = await request('POST', '/api/leaves', {
      date: '2026-08-10',
      type: 'sick',
      reason: 'Doctor checkup'
    }, token);

    if (leaveRes.statusCode === 201 && leaveRes.body.id) {
      console.log('✓ Add Leave Success!');
      leaveId = leaveRes.body.id;
    } else {
      console.error('✗ Add Leave Failed:', leaveRes);
      process.exit(1);
    }

    // 4. Test Prevent Duplicate Leave
    console.log('\n[4/5] Testing Double Booking Prevention...');
    const dupRes = await request('POST', '/api/leaves', {
      date: '2026-08-10',
      type: 'vacation',
      reason: 'Summer break'
    }, token);

    if (dupRes.statusCode === 400) {
      console.log('✓ Double Booking successfully prevented (400 Bad Request)');
    } else {
      console.error('✗ Double Booking check failed (expected 400, got):', dupRes);
      process.exit(1);
    }

    // 5. Test Delete Leave
    console.log('\n[5/5] Testing Delete Leave...');
    const delRes = await request('DELETE', `/api/leaves/${leaveId}`, null, token);

    if (delRes.statusCode === 200) {
      console.log('✓ Delete Leave Success!');
    } else {
      console.error('✗ Delete Leave Failed:', delRes);
      process.exit(1);
    }

    console.log('\n=== ALL API TESTS PASSED SUCCESSFULLY ===');
    process.exit(0);

  } catch (err) {
    console.error('Test execution failed with error:', err.message);
    process.exit(1);
  }
}

// Wait 1.5 seconds for the database/server to boot before running tests
setTimeout(runTests, 1500);
