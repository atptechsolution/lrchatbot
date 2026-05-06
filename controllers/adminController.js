'use strict';
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const User = require('../models/User');
const Chat = require('../models/Chat');
const Rate = require('../models/Rate');
const Notification = require('../models/Notification');

const EDIT_WINDOW_MS = 8 * 60 * 60 * 1000;
const FIELD_LABELS = { from: 'From', to: 'To', weight: 'Weight', description: 'Material', rate: 'Rate', amount: 'Amount' };

function isWithinEditWindow(createdAt) {
  return (Date.now() - new Date(createdAt).getTime()) < EDIT_WINDOW_MS;
}

// ─── USERS ───────────────────────────────────────────────────────────────────
async function getUsers(req, res) {
  const users = await User.find().sort({ approved: 1 }).lean();
  res.json(users);
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

// ─── CHATS (paginated) ───────────────────────────────────────────────────────
async function getChats(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = parseInt(req.query.skip) || 0;
    const query = {};

    if (req.query.hasPdf === 'true') query.pdfLink = { $exists: true, $ne: null, $ne: '' };
    if (req.query.userMobile) query.userMobile = req.query.userMobile;
    if (req.query.truckNumber) query.truckNumber = { $regex: req.query.truckNumber, $options: 'i' };

    const dateFilter = {};
    if (req.query.fromDate) dateFilter.$gte = new Date(req.query.fromDate);
    if (req.query.toDate) dateFilter.$lte = new Date(req.query.toDate + 'T23:59:59');
    if (Object.keys(dateFilter).length) query.createdAt = dateFilter;

    if (req.query.fromCity) query.from = { $regex: req.query.fromCity, $options: 'i' };
    if (req.query.toCity) query.to = { $regex: req.query.toCity, $options: 'i' };

    const [chats, total] = await Promise.all([
      Chat.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Chat.countDocuments(query),
    ]);

    res.json({ chats, total, hasMore: skip + limit < total });
  } catch (err) {
    console.error('getChats error:', err);
    res.status(500).json({ chats: [], total: 0, hasMore: false });
  }
}

// ─── CANCEL BUILTY ───────────────────────────────────────────────────────────
async function cancelBuilty(req, res) {
  try {
    const { role, editorMobile } = req.body;
    const chat = await Chat.findById(req.params.id);
    if (!chat) return res.status(404).json({ msg: 'Builty not found' });
    if (chat.status === 'canceled') return res.status(400).json({ msg: 'Already cancelled' });

    if (role === 'subadmin' || role === 'manager') {
      if (chat.userMobile !== editorMobile) return res.status(403).json({ msg: 'You can only cancel your own builties' });
      if (!isWithinEditWindow(chat.createdAt)) return res.status(403).json({ msg: 'Cannot cancel after 8 hours' });
    }

    chat.status = 'canceled';
    await chat.save();
    res.json({ msg: 'Cancelled', chat });
  } catch (err) {
    console.error('cancelBuilty error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
}

// ─── EDIT BUILTY ─────────────────────────────────────────────────────────────
async function editBuilty(req, res) {
  try {
    const { from, to, weight, description, rate, amount, editedBy, role, editorMobile } = req.body;
    const chat = await Chat.findById(req.params.id);
    if (!chat) return res.status(404).json({ msg: 'Builty not found' });

    if (role === 'subadmin' || role === 'manager') {
      if (chat.userMobile !== editorMobile) return res.status(403).json({ msg: 'You can only edit your own builties' });
      if (!isWithinEditWindow(chat.createdAt)) return res.status(403).json({ msg: 'Cannot edit after 8 hours' });
    }

    const editHistory = [];
    const checks = { from, to, weight, description };
    for (const [field, newVal] of Object.entries(checks)) {
      if (newVal !== undefined && newVal !== '' && String(newVal) !== String(chat[field] || '')) {
        editHistory.push({ field, oldValue: String(chat[field] || ''), newValue: String(newVal) });
      }
    }
    if (rate !== undefined && rate !== '' && parseFloat(rate) !== chat.rate) {
      editHistory.push({ field: 'rate', oldValue: String(chat.rate || ''), newValue: String(rate) });
    }
    if (amount !== undefined && amount !== '' && parseFloat(amount) !== chat.amount) {
      editHistory.push({ field: 'amount', oldValue: String(chat.amount || ''), newValue: String(amount) });
    }

    const update = { isEdited: true, editedBy: editedBy || 'Subadmin', editedAt: new Date(), editHistory };
    if (from !== undefined && from !== '') update.from = from;
    if (to !== undefined && to !== '') update.to = to;
    if (weight !== undefined && weight !== '') update.weight = weight;
    if (description !== undefined && description !== '') update.description = description;
    if (rate !== undefined && rate !== '') update.rate = parseFloat(rate);
    if (amount !== undefined && amount !== '') update.amount = parseFloat(amount);

    const updated = await Chat.findByIdAndUpdate(req.params.id, update, { new: true }).lean();
    res.json({ msg: 'Updated', chat: updated });
  } catch (err) {
    console.error('editBuilty error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
}

// ─── SET RATE (manager) ───────────────────────────────────────────────────────
async function setBuiltyRate(req, res) {
  try {
    const { rate, amount, isFixedAmount, setBy } = req.body;
    const chat = await Chat.findById(req.params.id);
    if (!chat) return res.status(404).json({ msg: 'Builty not found' });

    const update = { rateSetBy: setBy || 'Manager' };
    if (isFixedAmount === true || isFixedAmount === 'true') {
      update.isFixedAmount = true;
      update.amount = parseFloat(amount);
      update.rate = null;
    } else {
      update.isFixedAmount = false;
      update.rate = parseFloat(rate);
      const wKg = parseFloat(chat.weight);
      if (!isNaN(wKg) && !isNaN(update.rate)) {
        update.amount = Math.round((wKg / 1000) * update.rate);
      }
    }

    const updated = await Chat.findByIdAndUpdate(req.params.id, update, { new: true }).lean();
    res.json({ msg: 'Rate updated', chat: updated });
  } catch (err) {
    console.error('setBuiltyRate error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
}

// ─── CLEAR DATA BY DATE ───────────────────────────────────────────────────────
async function clearChats(req, res) {
  try {
    const { tillDate } = req.query;
    if (!tillDate) return res.status(400).json({ msg: 'tillDate required' });
    const cutoff = new Date(tillDate + 'T23:59:59');
    const chats = await Chat.find({ createdAt: { $lte: cutoff } }).select('pdfLink').lean();

    const pdfDir = path.join(__dirname, '..', 'pdf', 'generated');
    for (const chat of chats) {
      if (chat.pdfLink) {
        try { fs.unlinkSync(path.join(pdfDir, path.basename(chat.pdfLink))); } catch (_) {}
      }
    }

    const result = await Chat.deleteMany({ createdAt: { $lte: cutoff } });
    res.json({ msg: 'Deleted', count: result.deletedCount });
  } catch (err) {
    console.error('clearChats error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
}

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
async function sendNotification(req, res) {
  try {
    const { title, message, sentBy } = req.body;
    if (!title || !message) return res.status(400).json({ msg: 'Title and message required' });
    const notif = await Notification.create({ title, message, sentBy: sentBy || 'Admin' });
    res.json({ msg: 'Sent', notification: notif });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
}

async function getNotifications(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const skip = parseInt(req.query.skip) || 0;
    const [notifications, total] = await Promise.all([
      Notification.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Notification.countDocuments(),
    ]);
    res.json({ notifications, total, hasMore: skip + limit < total });
  } catch (err) {
    res.status(500).json({ notifications: [], total: 0, hasMore: false });
  }
}

// ─── RATES ────────────────────────────────────────────────────────────────────
async function getRates(req, res) {
  const rates = await Rate.find().sort({ createdAt: -1 }).lean();
  res.json(rates);
}

async function createRate(req, res) {
  const { from, to, itemKeyword, ratePerTon, party } = req.body;
  if (!from || !to || !itemKeyword || !ratePerTon) return res.status(400).json({ msg: 'All fields required' });
  await Rate.create({ from, to, itemKeyword, ratePerTon, party: party || 'All' });
  res.json({ msg: 'Rate created' });
}

async function updateRate(req, res) {
  const { from, to, itemKeyword, ratePerTon, party } = req.body;
  if (!from || !to || !itemKeyword || !ratePerTon) return res.status(400).json({ msg: 'All fields required' });
  const rate = await Rate.findByIdAndUpdate(req.params.id, { from, to, itemKeyword, ratePerTon, party: party || 'All' }, { new: true });
  if (!rate) return res.status(404).json({ msg: 'Rate not found' });
  res.json({ msg: 'Rate updated', rate });
}

async function deleteRate(req, res) {
  await Rate.findByIdAndDelete(req.params.id);
  res.json({ msg: 'Rate deleted' });
}

// ─── REPORTS ──────────────────────────────────────────────────────────────────
function buildReportQuery({ template, from, to }) {
  const query = {};
  if (template && template !== 'all') query.templateName = template;
  const dateFilter = {};
  if (from) dateFilter.$gte = new Date(from);
  if (to) dateFilter.$lte = new Date(to + 'T23:59:59');
  if (Object.keys(dateFilter).length) query.createdAt = dateFilter;
  return query;
}

async function reportPreview(req, res) {
  try {
    const chats = await Chat.find(buildReportQuery(req.query)).sort({ createdAt: -1 }).limit(200).lean();
    res.json(chats);
  } catch (err) {
    res.status(500).json([]);
  }
}

async function reportExport(req, res) {
  try {
    const chats = await Chat.find(buildReportQuery(req.query)).sort({ createdAt: 1 }).lean();
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('LR_REPORT');

    ws.columns = [
      { header: 'DATE', key: 'date', width: 15 },
      { header: 'Vehicle No.', key: 'truck', width: 18 },
      { header: 'FROM', key: 'from', width: 15 },
      { header: 'TO', key: 'to', width: 15 },
      { header: 'MATERIAL', key: 'contain', width: 20 },
      { header: 'Weight KG', key: 'wKg', width: 12 },
      { header: 'Weight Ton', key: 'wTon', width: 12 },
      { header: 'RATE', key: 'rate', width: 12 },
      { header: 'AMOUNT', key: 'amount', width: 15 },
      { header: 'A/C NAME', key: 'acName', width: 20 },
      { header: 'Edited By', key: 'editedBy', width: 18 },
      { header: 'Rate Set By', key: 'rateSetBy', width: 18 },
      { header: 'Remark', key: 'remark', width: 45 },
    ];

    ws.getRow(1).eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } };
      cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
    });

    chats.forEach((c) => {
      const wKg = parseFloat(c.weight);
      const isCanceled = c.status === 'canceled';
      let remark = '';
      if (isCanceled) {
        remark = 'CANCELED';
      } else if (c.isEdited && c.editHistory && c.editHistory.length) {
        remark = c.editHistory.map(e => `${FIELD_LABELS[e.field] || e.field}: ${e.oldValue}→${e.newValue}`).join(', ');
      }

      const row = ws.addRow({
        date: new Date(c.createdAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }),
        truck: c.truckNumber || '',
        from: c.from || '',
        to: c.to || '',
        contain: c.description || '',
        wKg: c.weight || '',
        wTon: wKg ? (wKg / 1000).toFixed(2) : '',
        rate: c.isFixedAmount ? 'Fixed' : (c.rate || ''),
        amount: c.amount || '',
        acName: c.userName || '',
        editedBy: c.isEdited ? (c.editedBy || '') : '',
        rateSetBy: c.rateSetBy || '',
        remark,
      });

      if (isCanceled) {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCCCC' } };
          cell.font = { color: { argb: 'FFFF0000' } };
        });
      } else if (c.isEdited) {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } };
          cell.font = { color: { argb: 'FF856404' } };
        });
      }
    });

    const file = path.join('/tmp', `LR_REPORT_${Date.now()}.xlsx`);
    await workbook.xlsx.writeFile(file);
    res.download(file, 'LR_Report.xlsx', () => {
      try { fs.unlinkSync(file); } catch (_) {}
    });
  } catch (err) {
    console.error('Excel export failed:', err);
    res.status(500).json({ msg: 'Excel export failed' });
  }
}

module.exports = {
  getUsers, approveUser, changeTemplate, changeRole, deleteUser,
  getChats, cancelBuilty, editBuilty, setBuiltyRate, clearChats,
  sendNotification, getNotifications,
  getRates, createRate, updateRate, deleteRate,
  reportPreview, reportExport,
};
