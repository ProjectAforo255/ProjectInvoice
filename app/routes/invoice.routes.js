const express = require('express')
const router = express.Router()

const { getInvoices, getInvoiceById, addInvoice } = require('../controllers/invoice.controller')

router.get('/getInvoices', getInvoices) 
router.get('/getInvoiceById/:id', getInvoiceById)
router.post('/addInvoice', addInvoice)

module.exports = router