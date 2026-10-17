const http = require('http');
const { generateToken } = require('../server/auth');

const token = generateToken({ id: 2, email: 'jasonleav@gmail.com', name: 'Jason Leav', is_admin: 1 });

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function run() {
  console.log('1. Fetching class groups...');
  const groupsRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/attendance/groups',
    method: 'GET',
    headers: { Authorization: 'Bearer ' + token }
  });
  console.log('Groups status:', groupsRes.status, 'Total groups:', groupsRes.data.length);
  const sampleGroup = groupsRes.data.find(g => g.code === 'I2-GCA-A');
  console.log('Sample group I2-GCA-A:', sampleGroup);

  console.log('\n2. Starting an Attendance Session for I2-GCA-A...');
  const sessionRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/attendance/sessions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token
    }
  }, {
    groupId: sampleGroup.id,
    title: 'Recitation Session - Thermodynamics',
    passcode: '1234'
  });
  console.log('Start session response:', sessionRes.status, sessionRes.data);
  const session = sessionRes.data;

  console.log('\n3. Student public lookup for code:', session.sessionCode);
  const lookupRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/attendance/lookup/' + session.sessionCode,
    method: 'GET'
  });
  console.log('Lookup status:', lookupRes.status, 'Group:', lookupRes.data.groupCode, 'Enrolled students:', lookupRes.data.students.length);

  console.log('\n4. Student check-in for e20250752 (BAN DALIN)...');
  const checkinRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/attendance/checkin',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    sessionCode: session.sessionCode,
    studentId: 'e20250752',
    passcode: '1234'
  });
  console.log('Check-in status:', checkinRes.status, checkinRes.data);

  console.log('\n5. Tutor fetching live roster for session...');
  const liveRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/attendance/sessions/' + session.sessionId,
    method: 'GET',
    headers: { Authorization: 'Bearer ' + token }
  });
  console.log('Live session stats:', liveRes.data.stats);
  const checkedIn = liveRes.data.roster.find(s => s.student_code === 'e20250752');
  console.log('Student BAN DALIN status:', checkedIn.status, 'Method:', checkedIn.method);

  console.log('\n6. Exporting official ITC CSV...');
  const exportRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/attendance/sessions/' + session.sessionId + '/export-itc-csv?token=' + token,
    method: 'GET'
  });
  console.log('Export status:', exportRes.status);
  console.log('Export CSV preview:\n' + (exportRes.body || '').split('\n').slice(0, 8).join('\n'));
}

run().catch(console.error);
