'use strict';
const path = require('path');
const ExcelJS = require('exceljs');
const fs = require('fs');
const User = require('../models/User');
const Chat = require('../models/Chat');
const Rate = require('../models/Rate');

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

async function changeRole(req, res) {
  await User.findByIdAndUpdate(req.params.id, { role: req.body.role });
  res.json({ msg: 'Role changed' });
}

async function deleteUser(req, res) {
  const { id } = req.params;
  await User.findByIdAndDelete(id);
  await Chat.deleteMany({ userId: id });
  res.json({ msg: 'User deleted' });
}

// Rates Management
async function getRates(req, res) {
  const rates = await Rate.find().sort({ createdAt: -1 });
  res.json(rates);
}

async function createRate(req, res) {
  const { from, to, itemKeyword, ratePerTon } = req.body;
  if (!from || !to || !itemKeyword || !ratePerTon) return res.status(400).json({ msg: 'All fields required' });
  await Rate.create({ from, to, itemKeyword, ratePerTon });
  res.json({ msg: 'Rate created' });
}

async function deleteRate(req, res) {
  await Rate.findByIdAndDelete(req.params.id);
  res.json({ msg: 'Rate deleted' });
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

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('LR_REPORT');

    worksheet.columns = [
      { header: 'DATE', key: 'date', width: 15 },
      { header: 'Vehicle Number', key: 'truck', width: 20 },
      { header: 'FROM', key: 'from', width: 15 },
      { header: 'To', key: 'to', width: 15 },
      { header: 'CONTAIN', key: 'contain', width: 20 },
      { header: 'Weight', key: 'weightKg', width: 10 },
      { header: 'Weig', key: 'weightTon', width: 10 },
      { header: 'RATE', key: 'rate', width: 10 },
      { header: 'AMOUNT', key: 'amount', width: 15 },
      { header: 'A/C NAME', key: 'acName', width: 20 },
      { header: 'Remark', key: 'remark', width: 15 }
    ];

    // Style the header row
    worksheet.getRow(1).eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4F81BD' } // blue header like image
      };
      cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
    });

    chats.forEach((c) => {
      // Parse weight in tons if exists
      let wKg = parseFloat(c.weight);
      let wTon = wKg ? (wKg / 1000).toFixed(2) : '';
      
      const isCanceled = c.status === 'canceled';

      const row = worksheet.addRow({
        date: new Date(c.createdAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }),
        truck: c.truckNumber || '',
        from: c.from || '',
        to: c.to || '',
        contain: c.description || '',
        weightKg: c.weight || '',
        weightTon: wTon,
        rate: c.rate || '',
        amount: c.amount || '',
        acName: c.userName || '',
        remark: isCanceled ? 'canceled' : ''
      });

      if (isCanceled) {
        row.eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFCCCC' } // light red background
          };
          cell.font = { color: { argb: 'FFFF0000' } }; // red text
        });
      }
    });

    const file = `LR_REPORT_${Date.now()}.xlsx`;
    await workbook.xlsx.writeFile(file);

    res.download(file, () => {
      try { fs.unlinkSync(file); } catch (_) {}
    });
  } catch (err) {
    console.error('Excel export failed:', err);
    res.status(500).json({ msg: 'Excel export failed' });
  }
}

module.exports = { 
  getUsers, getChats, approveUser, changeTemplate, changeRole, deleteUser, 
  getRates, createRate, deleteRate,
  reportPreview, reportExport 
};
