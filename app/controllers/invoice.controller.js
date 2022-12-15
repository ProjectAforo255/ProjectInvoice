const invoiceService = require('../services/invoice.service')

const getInvoices = async (req, res) => {
    return res.send(await invoiceService.getInvoices())
}

const getInvoiceById = async (req, res) => {
    const id = parseInt(req.params.id)
    return res.send(await invoiceService.getInvoiceById(id))
}

const addInvoice = async (req, res) => {
    const { amount, customerId, fullname } = req.body
    return res.send(await invoiceService.addInvoice(amount, customerId, fullname))
}

module.exports = { getInvoices, getInvoiceById, addInvoice }