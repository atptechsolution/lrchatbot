'use strict';
const path = require('path');
const User = require('../models/User');
const Chat = require('../models/Chat');
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

async function handleUserMessage(socket, io, { mobile, message }, appRoot) {
  try {
    const user = await User.findOne({ mobile });
    if (!user || !user.approved) return;

    const lr = await extractDetails(message);

    /* Validation */
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
        message: `⚠️ LR INCOMPLETE\n\nOriginal Message:\n"${message}"\n\nMissing Details:\n` +
          missing.map(m => `• ${m}`).join('\n'),
        truckNumber: '-',
        weight: '-',
        pdfLink: '',
        templateName: user.assignedTemplate,
        createdAt: new Date().toISOString(),
        isError: true,
      });
      return;
    }

    const { date: istDate, time: istTime } = getIST();
    const logoPath = getLogoPath(user.assignedTemplate, appRoot);

    const pdfFile = await generatePdf(user.assignedTemplate, {
      truckNumber: lr.truckNumber,
      from: lr.from || '',
      to: lr.to || '',
      weight: lr.weight,
      description: lr.description,
      date: istDate,
      time: istTime,
      logoPath,
    });

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
    };

    await Chat.create(payload);

    /* Send to user — NO "Generated Successfully" toast, just PDF link */
    socket.emit('botMessage', {
      pdfLink: payload.pdfLink,
      pdfName: `${lr.truckNumber}.pdf`,
      truckNumber: lr.truckNumber,
      from: lr.from || '',
      to: lr.to || '',
      weight: lr.weight,
      description: lr.description,
    });

    io.emit('adminMessage', payload);
  } catch (err) {
    console.error('LR error:', err);
    socket.emit('botMessage', { text: '❌ Server error. Please try again later.' });
  }
}

module.exports = { handleUserMessage };
