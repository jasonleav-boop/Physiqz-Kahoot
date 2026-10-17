const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { db } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'physics_jwt_secret_key_dtc_kahoot_2026';

function generateToken(tutor) {
  return jwt.sign(
    { id: tutor.id, email: tutor.email, name: tutor.name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function registerTutor(name, email, password) {
  const existing = db.prepare('SELECT id FROM tutors WHERE LOWER(email) = LOWER(?)').get(email);
  if (existing) {
    throw new Error('An account with this email already exists.');
  }

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(password, salt);

  const result = db.prepare('INSERT INTO tutors (name, email, password_hash) VALUES (?, ?, ?)')
    .run(name, email.toLowerCase().trim(), passwordHash);

  const tutor = { id: result.lastInsertRowid, name, email: email.toLowerCase().trim() };
  const token = generateToken(tutor);
  return { tutor, token };
}

function loginTutor(email, password) {
  const tutor = db.prepare('SELECT id, name, email, password_hash FROM tutors WHERE LOWER(email) = LOWER(?)')
    .get(email.trim());

  if (!tutor) {
    throw new Error('Invalid email or password.');
  }

  const isMatch = bcrypt.compareSync(password, tutor.password_hash);
  if (!isMatch) {
    throw new Error('Invalid email or password.');
  }

  const tutorData = { id: tutor.id, name: tutor.name, email: tutor.email };
  const token = generateToken(tutorData);
  return { tutor: tutorData, token };
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required.' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token.' });
    }
    req.tutor = decoded;
    next();
  });
}

module.exports = {
  registerTutor,
  loginTutor,
  authenticateToken,
  generateToken
};
