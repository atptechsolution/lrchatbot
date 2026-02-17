'use strict';
const path = require('path');
const XLSX = require('xlsx');
const fs = require('fs');
const User = require('../models/User');
const Chat = require('../models/Chat');

async function getUsers(req, res) {
  const users = await User.find().sort({ approved: 1 });
  res.json(users);
}

async function getChats(req, res) {
  const chats = await Chat.find().sort({ createdAt: 1 });
  res.json(chats);
}

async function approveUser(req, res) {
  await User.findByIdAndUpdate(req.params.id, { approved: true });
  res.json({ msg: 'Approved' });
}

async function changeTemplate(req, res) {
  await User.findByIdAndUpdate(req.params.id, { assignedTemplate: req.body.template });
  res.json({ msg: 'Template changed' });
}

async function deleteUser(req, res) {
  const { id } = req.params;
  await User.findByIdAndDelete(id);
  await Chat.deleteMany({ userId: id });
  res.json({ msg: 'User deleted' });
}

function buildQuery({ template, from, to }) {
  const query = {};
  if (template && template !== 'all') query.templateName = template;
  if (from || to) {
    query.createdAt = {};
    if (from) query.createdAt.$gte = new Date(from);
    if (to) query.createdAt.$lte = new Date(to + 'T23:59:59');
  }
  return query;
}

async function reportPreview(req, res) {
  try {
    const chats = await Chat.find(buildQuery(req.query)).sort({ createdAt: -1 });
    res.json(chats);
  } catch (err) {
    console.error('Report preview failed:', err);
    res.status(500).json([]);
  }
}

async function reportExport(req, res) {
  try {
    const chats = await Chat.find(buildQuery(req.query)).sort({ createdAt: 1 });

    const rows = chats.map(c => ({
      Template: c.templateName,
      User: c.userName,
      Mobile: c.userMobile,
      TruckNumber: c.truckNumber,
      From: c.from,
      To: c.to,
      Weight: c.weight,
      Description: c.description,
      Date: new Date(c.createdAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }),
      Time: new Date(c.createdAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
      PDF: c.pdfLink,
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'LR_REPORT');

    const file = `LR_REPORT_${Date.now()}.xlsx`;
    XLSX.writeFile(wb, file);

    res.download(file, () => {
      try { fs.unlinkSync(file); } catch (_) {}
    });
  } catch (err) {
    console.error('Excel export failed:', err);
    res.status(500).json({ msg: 'Excel export failed' });
  }
}

module.exports = { getUsers, getChats, approveUser, changeTemplate, deleteUser, reportPreview, reportExport };
