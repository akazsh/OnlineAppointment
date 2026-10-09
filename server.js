require('dotenv').config();

const crypto = require('node:crypto');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const express = require('express');
const session = require('express-session');
const { Pool } = require('pg');

const app = express();
const port = Number(process.env.PORT || 3000);
const databaseName = process.env.PGDATABASE || 'appointmentsystem';
const databaseOptions = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT || 5969),
      database: databaseName,
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || '',
    };
let pool = new Pool(databaseOptions);

app.use(express.json({ limit: '32kb' }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'replace-this-session-secret-before-deployment',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60 * 1000 },
}));
app.use(express.static(path.join(__dirname, 'public')));

function cleanText(value, maxLength = 300) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function requireUser(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Sign in to continue.' });
  next();
}

function validDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === date;
}

function slotTimes(date, durationMinutes, busyTimes = []) {
  if (!validDate(date) || date < new Date().toISOString().slice(0, 10)) return [];
  const slots = [];
  const openingMinute = 9 * 60;
  const closingMinute = 17 * 60;
  const now = new Date();
  const isToday = date === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  for (let minute = openingMinute; minute + durationMinutes <= closingMinute; minute += 30) {
    const time = `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
    if (isToday && minute <= now.getHours() * 60 + now.getMinutes()) continue;
    if (!busyTimes.some((busy) => minute < busy.end && minute + durationMinutes > busy.start)) slots.push(time);
  }
  return slots;
}

async function connectDatabase() {
  try {
    await pool.query('SELECT 1');
  } catch (error) {
    if (error.code !== '3D000' || process.env.DATABASE_URL) throw error;
    const adminPool = new Pool({ ...databaseOptions, database: process.env.PGADMIN_DATABASE || 'postgres' });
    try {
      const safeName = databaseName.replaceAll('"', '""');
      await adminPool.query(`CREATE DATABASE "${safeName}"`);
    } catch (createError) {
      if (createError.code !== '42P04') throw createError;
    } finally {
      await adminPool.end();
    }
    pool = new Pool(databaseOptions);
    await pool.query('SELECT 1');
  }
}

async function initializeDatabase() {
  await connectDatabase();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(254) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role VARCHAR(20) NOT NULL CHECK (role IN ('customer', 'provider')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS providers (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      business_name VARCHAR(120) NOT NULL,
      category VARCHAR(60) NOT NULL,
      bio TEXT NOT NULL DEFAULT '',
      location VARCHAR(120) NOT NULL,
      duration_minutes INTEGER NOT NULL DEFAULT 60 CHECK (duration_minutes BETWEEN 15 AND 240),
      price_cents INTEGER NOT NULL DEFAULT 5000 CHECK (price_cents >= 0),
      rating NUMERIC(2,1) NOT NULL DEFAULT 5.0,
      photo_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS appointments (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES users(id),
      provider_id INTEGER NOT NULL REFERENCES providers(user_id),
      starts_at TIMESTAMP NOT NULL,
      ends_at TIMESTAMP NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'completed')),
      notes VARCHAR(500) NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (ends_at > starts_at)
    );
    CREATE INDEX IF NOT EXISTS appointments_provider_time_idx ON appointments(provider_id, starts_at) WHERE status = 'confirmed';
    CREATE INDEX IF NOT EXISTS appointments_client_time_idx ON appointments(client_id, starts_at DESC);
  `);
  await seedProviders();
}

async function seedProviders() {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM providers');
  if (rows[0].count > 0) return;
  const samples = [
    ['Dr. Maya Chen', 'maya.chen@sample.invalid', 'Harbor Dental Studio', 'Dental care', 'Brooklyn, NY', 45, 9500, 'Gentle, thoughtful dentistry with a focus on keeping every visit calm and clear.', 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=900&q=85'],
    ['Jordan Ellis', 'jordan.ellis@sample.invalid', 'Common Ground Therapy', 'Therapy', 'Brooklyn, NY', 50, 14000, 'A welcoming space for working through change, stress, and the things that feel hard to name.', 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=900&q=85'],
    ['Amara Okafor', 'amara.okafor@sample.invalid', 'Stillwater Bodywork', 'Massage', 'Queens, NY', 60, 11000, 'Restorative massage shaped around your body, your boundaries, and what you need today.', 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=900&q=85'],
    ['Leo Martinez', 'leo.martinez@sample.invalid', 'Studio Leo', 'Hair & beauty', 'Manhattan, NY', 45, 7500, 'Considered cuts and easy-to-wear color, made for real life and your own sense of style.', 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=900&q=85'],
    ['Priya Shah', 'priya.shah@sample.invalid', 'Northstar Learning', 'Coaching', 'Remote', 60, 8500, 'One-to-one coaching for clearer goals, steadier habits, and a little more room to grow.', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=900&q=85'],
    ['Nico Laurent', 'nico.laurent@sample.invalid', 'Open Door Wellness', 'Wellness', 'Manhattan, NY', 45, 9000, 'Practical, whole-person wellness sessions with small steps you can actually take home.', 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=900&q=85'],
  ];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const [name, email, business, category, location, duration, price, bio, photo] of samples) {
      const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
      const user = await client.query(
        `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'provider') ON CONFLICT (email) DO NOTHING RETURNING id`,
        [name, email, passwordHash],
      );
      if (user.rows[0]) {
        await client.query(
          'INSERT INTO providers (user_id, business_name, category, location, duration_minutes, price_cents, bio, photo_url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
          [user.rows[0].id, business, category, location, duration, price, bio, photo],
        );
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

app.get('/api/providers', async (req, res, next) => {
  try {
    const search = `%${cleanText(req.query.search, 80)}%`;
    const category = cleanText(req.query.category, 60);
    const { rows } = await pool.query(
      `SELECT u.id, u.name, p.business_name, p.category, p.bio, p.location,
              p.duration_minutes, p.price_cents, p.rating, p.photo_url
       FROM providers p JOIN users u ON u.id = p.user_id
       WHERE ($1 = '%%' OR p.business_name ILIKE $1 OR p.category ILIKE $1 OR p.location ILIKE $1 OR u.name ILIKE $1)
         AND ($2 = '' OR p.category = $2)
       ORDER BY p.rating DESC, p.created_at DESC`,
      [search, category],
    );
    res.json(rows);
  } catch (error) { next(error); }
});

app.get('/api/providers/:id/slots', async (req, res, next) => {
  try {
    const date = cleanText(req.query.date, 10);
    if (!validDate(date)) return res.status(400).json({ error: 'Choose a valid date.' });
    const provider = await pool.query('SELECT duration_minutes FROM providers WHERE user_id = $1', [req.params.id]);
    if (!provider.rows[0]) return res.status(404).json({ error: 'Provider not found.' });
    const busy = await pool.query(
      `SELECT EXTRACT(HOUR FROM starts_at)::int * 60 + EXTRACT(MINUTE FROM starts_at)::int AS start_minute,
              EXTRACT(HOUR FROM ends_at)::int * 60 + EXTRACT(MINUTE FROM ends_at)::int AS end_minute
       FROM appointments WHERE provider_id = $1 AND starts_at::date = $2::date AND status = 'confirmed'`,
      [req.params.id, date],
    );
    const busyTimes = busy.rows.map((row) => ({ start: Number(row.start_minute), end: Number(row.end_minute) }));
    res.json({ slots: slotTimes(date, provider.rows[0].duration_minutes, busyTimes) });
  } catch (error) { next(error); }
});

app.post('/api/auth/register', async (req, res, next) => {
  const name = cleanText(req.body.name, 100);
  const email = cleanText(req.body.email, 254).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const role = req.body.role === 'provider' ? 'provider' : 'customer';
  if (name.length < 2 || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) {
    return res.status(400).json({ error: 'Add your name, a valid email, and a password with at least 8 characters.' });
  }
  const businessName = cleanText(req.body.businessName, 120);
  const category = cleanText(req.body.category, 60);
  const location = cleanText(req.body.location, 120);
  const bio = cleanText(req.body.bio, 1000);
  const duration = Number(req.body.duration || 60);
  const price = Math.round(Number(req.body.price || 50) * 100);
  if (role === 'provider' && (!businessName || !category || !location || !Number.isInteger(duration) || duration < 15 || duration > 240 || !Number.isFinite(price) || price < 0 || price > 1000000)) {
    return res.status(400).json({ error: 'Complete your business profile with a valid service length and price.' });
  }
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const userResult = await client.query(
        'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role',
        [name, email, passwordHash, role],
      );
      const user = userResult.rows[0];
      if (role === 'provider') {
        await client.query(
          'INSERT INTO providers (user_id, business_name, category, bio, location, duration_minutes, price_cents) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [user.id, businessName, category, bio, location, duration, price],
        );
      }
      await client.query('COMMIT');
      req.session.user = user;
      res.status(201).json({ user });
    } catch (error) {
      await client.query('ROLLBACK');
      if (error.code === '23505') return res.status(409).json({ error: 'An account with that email already exists.' });
      throw error;
    } finally { client.release(); }
  } catch (error) { next(error); }
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const email = cleanText(req.body.email, 254).toLowerCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const result = await pool.query('SELECT id, name, email, role, password_hash FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: 'Email or password did not match.' });
    req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role };
    res.json({ user: req.session.user });
  } catch (error) { next(error); }
});

app.post('/api/auth/logout', (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

app.get('/api/me', (req, res) => res.json({ user: req.session.user || null }));

app.get('/api/appointments', requireUser, async (req, res, next) => {
  try {
    const field = req.session.user.role === 'provider' ? 'a.provider_id' : 'a.client_id';
    const { rows } = await pool.query(
      `SELECT a.id, to_char(a.starts_at, 'YYYY-MM-DD') AS date, to_char(a.starts_at, 'HH24:MI') AS time,
              a.status, a.notes, a.ends_at - a.starts_at AS duration,
              client.name AS client_name, provider_user.name AS provider_name,
              p.business_name, p.category, p.location, p.price_cents
       FROM appointments a
       JOIN users client ON client.id = a.client_id
       JOIN providers p ON p.user_id = a.provider_id
       JOIN users provider_user ON provider_user.id = a.provider_id
       WHERE ${field} = $1 ORDER BY a.starts_at DESC`,
      [req.session.user.id],
    );
    res.json(rows);
  } catch (error) { next(error); }
});

app.post('/api/appointments', requireUser, async (req, res, next) => {
  if (req.session.user.role !== 'customer') return res.status(403).json({ error: 'Provider accounts cannot book appointments.' });
  const providerId = Number(req.body.providerId);
  const date = cleanText(req.body.date, 10);
  const time = cleanText(req.body.time, 5);
  const notes = cleanText(req.body.notes, 500);
  if (!Number.isInteger(providerId) || !validDate(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    return res.status(400).json({ error: 'Choose a valid provider, date, and time.' });
  }
  if (date < new Date().toISOString().slice(0, 10)) return res.status(400).json({ error: 'Appointments must be in the future.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [providerId]);
    const provider = await client.query('SELECT duration_minutes FROM providers WHERE user_id = $1', [providerId]);
    if (!provider.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Provider not found.' });
    }
    const { rows: busyRows } = await client.query(
      `SELECT EXTRACT(HOUR FROM starts_at)::int * 60 + EXTRACT(MINUTE FROM starts_at)::int AS start_minute,
              EXTRACT(HOUR FROM ends_at)::int * 60 + EXTRACT(MINUTE FROM ends_at)::int AS end_minute
       FROM appointments WHERE provider_id = $1 AND starts_at::date = $2::date AND status = 'confirmed'`,
      [providerId, date],
    );
    const busyTimes = busyRows.map((row) => ({ start: Number(row.start_minute), end: Number(row.end_minute) }));
    if (!slotTimes(date, provider.rows[0].duration_minutes, busyTimes).includes(time)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'That time is no longer available. Choose another slot.' });
    }
    const result = await client.query(
      `INSERT INTO appointments (client_id, provider_id, starts_at, ends_at, notes)
       VALUES ($1, $2, $3::date + $4::time, $3::date + $4::time + ($5 * INTERVAL '1 minute'), $6) RETURNING id`,
      [req.session.user.id, providerId, date, time, provider.rows[0].duration_minutes, notes],
    );
    await client.query('COMMIT');
    res.status(201).json({ id: result.rows[0].id });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally { client.release(); }
});

app.patch('/api/appointments/:id', requireUser, async (req, res, next) => {
  const status = req.body.status;
  const user = req.session.user;
  if (!['cancelled', 'completed'].includes(status)) return res.status(400).json({ error: 'Unsupported appointment update.' });
  if (status === 'completed' && user.role !== 'provider') return res.status(403).json({ error: 'Only providers can mark visits complete.' });
  const ownerField = user.role === 'provider' ? 'provider_id' : 'client_id';
  try {
    const result = await pool.query(
      `UPDATE appointments SET status = $1 WHERE id = $2 AND ${ownerField} = $3 AND status = 'confirmed' RETURNING id`,
      [status, req.params.id, user.id],
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Appointment not found or already updated.' });
    res.json({ ok: true });
  } catch (error) { next(error); }
});

app.use('/api', (error, req, res, next) => {
  console.error(error);
  if (res.headersSent) return next(error);
  res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Something went wrong. Please try again.' : error.message });
});

initializeDatabase().then(() => {
  app.listen(port, () => console.log(`Appointment Hub is running at http://localhost:${port}`));
}).catch((error) => {
  console.error('\nCould not connect to PostgreSQL or initialize the app database.');
  console.error(`Configured database: ${process.env.PGDATABASE || 'appointmentsystem'} at ${process.env.PGHOST || 'localhost'}:${process.env.PGPORT || 5969}`);
  if (/password|authentication|SASL/i.test(error.message)) {
    console.error('PostgreSQL rejected the configured credentials. Set PGUSER and PGPASSWORD in .env, then run run.bat again.');
  } else {
    console.error('Set PGUSER, PGPASSWORD, PGDATABASE, or DATABASE_URL in .env and run run.bat again.');
  }
  console.error(error.message);
  process.exit(1);
});