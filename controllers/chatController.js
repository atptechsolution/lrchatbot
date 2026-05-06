'use strict';
const path = require('path');
const User = require('../models/User');
const Chat = require('../models/Chat');
const Rate = require('../models/Rate');
const { extractDetails } = require('../utils/lrExtractor');
const { generatePdf } = require('../utils/pdfGenerator');

function getLogoPath(templateName, __dirname_root) {
  if (templateName === 'av-logistics.ejs')
    return 'file://' + path.join(__dirname_root, 'public/assets/av-logistics-logo.png');
  if (templateName === 'namaskarm-road-lines.ejs')
    return 'file://' + path.join(__dirname_root, 'public/assets/namaskarm-logo.png');
  return '';
}

function getIST() {
  const now = new Date();
  return {
    date: now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }),
    time: now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
  };
}

function isWithinEditWindow(createdAt) {
  return (Date.now() - new Date(createdAt).getTime()) < 8 * 60 * 60 * 1000;
}

async function handleUserMessage(socket, io, { mobile, message }, appRoot) {
  try {
    const user = await User.findOne({ mobile }).lean();
    if (!user || !user.approved) return;

    const lowerMsg = message.toLowerCase().trim();

    // Cancel command — only subadmin/admin/manager, not regular users
    if (lowerMsg.startsWith('cancel ')) {
      if (user.role === 'user') {
        socket.emit('botMessage', { text: '❌ You do not have permission to cancel receipts.' });
        return;
      }
      const receiptNoStr = lowerMsg.replace('cancel ', '').trim();
      const receiptNo = parseInt(receiptNoStr, 10);
      if (!isNaN(receiptNo)) {
        const chat = await Chat.findOne({ receiptNo });
        if (!chat) {
          socket.emit('botMessage', { text: `❌ Receipt #${receiptNo} not found.` });
          return;
        }
        if (chat.status === 'canceled') {
          socket.emit('botMessage', { text: `⚠️ Receipt #${receiptNo} is already cancelled.` });
          return;
        }
        if (user.role === 'subadmin' || user.role === 'manager') {
          if (chat.userMobile !== mobile) {
            socket.emit('botMessage', { text: '❌ You can only cancel your own receipts.' });
            return;
          }
          if (!isWithinEditWindow(chat.createdAt)) {
            socket.emit('botMessage', { text: '❌ Cannot cancel after 8 hours of generation.' });
            return;
          }
        }
        chat.status = 'canceled';
        await chat.save();
        socket.emit('botMessage', { text: `✅ Receipt #${receiptNo} cancelled successfully.` });
        return;
      }
    }

    const lr = await extractDetails(message);

    const missing = [];
    if (!lr.truckNumber) missing.push('Truck Number');
    if (!lr.to) missing.push('Destination (To)');
    if (!lr.weight) missing.push('Weight');
    if (!lr.description) missing.push('Goods / Description');

    if (missing.length > 0) {
      socket.emit('botMessage', {
        text: `❌ LR Incomplete\n\nMissing Details:\n` +
          missing.map(m => `• ${m}`).join('\n') +
          `\n\nPlease resend like:\nMH09HH4512 24 ton Plastic Dana Indore to Nagpur`,
      });
      io.emit('adminMessage', {
        userId: user._id.toString(),
        userName: user.name,
        userMobile: user.mobile,
        message: `⚠️ LR INCOMPLETE — "${message}" — Missing: ${missing.join(', ')}`,
        truckNumber: '-',
        pdfLink: '',
        templateName: user.assignedTemplate,
        createdAt: new Date().toISOString(),
        isError: true,
      });
      return;
    }

    const { date: istDate, time: istTime } = getIST();
    const logoPath = getLogoPath(user.assignedTemplate, appRoot);

    // Generate PDF and auto-increment receipt in parallel with rate lookup
    const [pdfFile, lastChat, rates] = await Promise.all([
      generatePdf(user.assignedTemplate, {
        truckNumber: lr.truckNumber,
        from: lr.from || '',
        to: lr.to || '',
        weight: lr.weight,
        description: lr.description,
        date: istDate,
        time: istTime,
        logoPath,
      }),
      Chat.findOne().sort({ receiptNo: -1 }).select('receiptNo').lean(),
      Rate.find().lean(),
    ]);

    const nextReceiptNo = (lastChat && lastChat.receiptNo) ? lastChat.receiptNo + 1 : 1000;

    let calculatedRate = null;
    let calculatedAmount = null;
    if (lr.from && lr.to && lr.description && lr.weight) {
      for (const r of rates) {
        const partyMatch = !r.party || r.party === 'All' || r.party === user.name;
        if (
          partyMatch &&
          lr.from.toLowerCase() === r.from.toLowerCase() &&
          lr.to.toLowerCase() === r.to.toLowerCase() &&
          lr.description.toLowerCase().includes(r.itemKeyword.toLowerCase())
        ) {
          calculatedRate = r.ratePerTon;
          const wKg = parseFloat(lr.weight);
          if (!isNaN(wKg)) calculatedAmount = Math.round((wKg / 1000) * calculatedRate);
          break;
        }
      }
    }

    const payload = {
      userId: user._id.toString(),
      userName: user.name,
      userMobile: user.mobile,
      truckNumber: lr.truckNumber,
      from: lr.from || '',
      to: lr.to || '',
      weight: lr.weight,
      description: lr.description,
      message,
      pdfLink: `/pdf/generated/${pdfFile}`,
      templateName: user.assignedTemplate,
      receiptNo: nextReceiptNo,
      status: 'success',
      rate: calculatedRate,
      amount: calculatedAmount,
    };

    const saved = await Chat.create(payload);
    const responsePayload = { ...payload, _id: saved._id.toString(), createdAt: saved.createdAt.toISOString() };

    socket.emit('botMessage', responsePayload);
    io.emit('adminMessage', responsePayload);
  } catch (err) {
    console.error('LR error:', err);
    socket.emit('botMessage', { text: '❌ Server error. Please try again.' });
  }
}

module.exports = { handleUserMessage };
