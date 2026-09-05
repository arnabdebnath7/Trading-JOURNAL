import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { newId, now } from '../../shared/schema.js';
import db from './db.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'tradevault-dev-secret-change-me';
const TOKEN_DAYS = 365;

export function hashPassword(pw) {
  return bcrypt.hashSync(pw, 10);
}
export function verifyPassword(pw, hash) {
  try {
    return bcrypt.compareSync(pw, hash);
  } catch {
    return false;
  }
}
export function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, {
    expiresIn: `${TOKEN_DAYS}d`
  });
}

export function createUser({ email, password, name, capital }) {
  const emailNorm = String(email).trim().toLowerCase();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(emailNorm);
  if (existing) throw Object.assign(new Error('An account with this email already exists'), { status: 409 });
  const user = {
    id: newId(),
    email: emailNorm,
    password_hash: hashPassword(password),
    name: name || emailNorm.split('@')[0],
    capital: Number(capital) || 100000,
    created_at: now()
  };
  db.prepare(
    `INSERT INTO users (id, email, password_hash, name, capital, created_at)
     VALUES (@id, @email, @password_hash, @name, @capital, @created_at)`
  ).run(user);
  return publicUser(user);
}

export function authenticate(email, password) {
  const emailNorm = String(email).trim().toLowerCase();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(emailNorm);
  if (!user || !verifyPassword(password, user.password_hash)) {
    throw Object.assign(new Error('Invalid email or password'), { status: 401 });
  }
  return publicUser(user);
}

export function publicUser(u) {
  return { id: u.id, email: u.email, name: u.name, capital: u.capital, createdAt: u.created_at };
}

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not signed in' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub);
    if (!user) return res.status(401).json({ error: 'Account not found' });
    req.user = publicUser(user);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }
}
