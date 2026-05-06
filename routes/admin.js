'use strict';
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/adminController');

// Users
router.get('/users', ctrl.getUsers);
router.post('/approve/:id', ctrl.approveUser);
router.post('/template/:id', ctrl.changeTemplate);
router.post('/role/:id', ctrl.changeRole);
router.delete('/user/:id', ctrl.deleteUser);

// Chats (paginated)
router.get('/chats', ctrl.getChats);

// Builty actions
router.patch('/chat/:id/cancel', ctrl.cancelBuilty);
router.patch('/chat/:id/edit', ctrl.editBuilty);
router.patch('/chat/:id/set-rate', ctrl.setBuiltyRate);

// Data management
router.delete('/chats/clear', ctrl.clearChats);

// Notifications
router.post('/notification', ctrl.sendNotification);
router.get('/notifications', ctrl.getNotifications);

// Rates
router.get('/rates', ctrl.getRates);
router.post('/rates', ctrl.createRate);
router.put('/rates/:id', ctrl.updateRate);
router.delete('/rates/:id', ctrl.deleteRate);

// Reports
router.get('/report/preview', ctrl.reportPreview);
router.get('/report/export', ctrl.reportExport);

module.exports = router;
