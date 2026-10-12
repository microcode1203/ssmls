const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/forms.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get('/fields',        ctrl.getFieldReference);                 // placeholder tag reference for template designers
router.get('/',               ctrl.getForms);                         // everyone can browse
router.get('/:id',            ctrl.downloadForm);                     // everyone can download the blank template
router.post('/:id/generate',  authorize('teacher', 'admin'), ctrl.generateForm); // fill a template for one student
router.post('/',              authorize('admin'), ctrl.uploadForm);   // only admin uploads/designs templates
router.delete('/:id',         authorize('admin'), ctrl.deleteForm);

module.exports = router;
