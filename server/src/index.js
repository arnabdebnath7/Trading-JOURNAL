import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import db from './db.js';
import { createUser, authenticate, publicUser, authMiddleware, hashPassword, signToken } from './auth.js';
import syncRouter from './routes/sync.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3001;

const app = express();
app.use(cors({ origin: true, credentials: false }));
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

app.disable('x-powered-by');

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'tradevault', time: Date.now(), version: '1.0.0' });
});

// ---------------- Auth ----------------
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

app.post(
  '/api/auth/signup',
  wrap(async (req, res) => {
    const { email, password, name, capital } = req.body || {};
    if (!email || !password || String(password).length < 6) {
      return res.status(400).json({ error: 'Email and a password of at least 6 characters are required' });
    }
    const user = createUser({ email, password, name, capital });
    res.json({ token: signToken(user), user });
  })
);

app.post(
  '/api/auth/login',
  wrap(async (req, res) => {
    const { email, password } = req.body || {};
    const user = authenticate(email || '', password || '');
    res.json({ token: signToken(user), user });
  })
);

app.get('/api/auth/me', authMiddleware, (req, res) => res.json({ user: req.user }));

app.patch(
  '/api/auth/me',
  authMiddleware,
  wrap((req, res) => {
    const { name, capital, password } = req.body || {};
    const sets = [];
    const params = { id: req.user.id };
    if (name != null) { sets.push('name = @name'); params.name = name; }
    if (capital != null) { sets.push('capital = @capital'); params.capital = Number(capital) || 0; }
    if (password && String(password).length >= 6) {
      sets.push('password_hash = @ph');
      params.ph = hashPassword(String(password));
    }
    if (sets.length) db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = @id`).run(params);
    const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    res.json({ user: publicUser(u) });
  })
);

// ---------------- Data ----------------
app.use('/api', authMiddleware, syncRouter);

// ---------------- Static web build (production) ----------------
const dist = path.join(__dirname, '..', '..', 'web', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist, { index: false, maxAge: '1h' }));
  app.get(/^\/(?!api\/).*/, (req, res) => {
    res.sendFile(path.join(dist, 'index.html'));
  });
} else {
  app.get('/', (req, res) =>
    res.type('html').send('<h3>TradeVault API is running.</h3><p>The web app build was not found. Run <code>npm run build</code>.</p>')
  );
}

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || 'Server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`TradeVault server listening on http://0.0.0.0:${PORT}`);
});
