'use strict';
require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const { handleUserMessage } = require('./controllers/chatController');

/* ── MongoDB ── */
mongoose
  .connect(process.env.MONGO_URI || 'mongodb+srv://lr:Ram9616@cluster0.sunse44.mongodb.net/lrchat')
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ Mongo error', err));

/* ── App ── */
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/pdf', express.static(path.join(__dirname, 'pdf')));

/* ── Routes ── */
app.get('/', (req, res) => res.redirect('/login.html'));
app.use('/', authRoutes);
app.use('/admin', adminRoutes);

/* ── Socket ── */
const APP_ROOT = __dirname;
io.on('connection', socket => {
  socket.on('userMessage', data => handleUserMessage(socket, io, data, APP_ROOT));
});

/* ── Start ── */
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
