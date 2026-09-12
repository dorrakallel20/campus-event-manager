const express = require('express');
const path = require('path');
const methodOverride = require('method-override');
const { connectDB } = require('./db');

const dashboardRouter = require('./routes/dashboard');
const eventsRouter = require('./routes/events');
const usersRouter = require('./routes/users');
const analyticsRouter = require('./routes/analytics');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use('/public', express.static(path.join(__dirname, 'public')));

app.use('/', dashboardRouter);
app.use('/events', eventsRouter);
app.use('/users', usersRouter);
app.use('/analytics', analyticsRouter);

app.use((req, res) => {
  res.status(404).render('error', { message: 'Page introuvable.' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', { message: err.message || 'Erreur serveur.' });
});

async function start() {
  await connectDB();
  app.listen(PORT, () => console.log(`Campus Event Manager running on http://localhost:${PORT}`));
}

start().catch((e) => {
  console.error('Failed to start application:', e);
  process.exit(1);
});
