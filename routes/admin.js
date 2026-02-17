'use strict';
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/adminController');

router.get('/users', ctrl.getUsers);
router.get('/chats', ctrl.getChats);
router.post('/approve/:id', ctrl.approveUser);
router.post('/template/:id', ctrl.changeTemplate);
router.delete('/user/:id', ctrl.deleteUser);
router.get('/report/preview', ctrl.reportPreview);
router.get('/report/export', ctrl.reportExport);

module.exports = router;
