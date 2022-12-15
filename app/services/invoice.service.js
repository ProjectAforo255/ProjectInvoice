const invoiceRepository = require('../repositories/invoice.repository')

const invoiceService = {
    getInvoices: async () => {
        return await invoiceRepository.getInvoces()
    },
    getInvoiceById: async (id) => {
        return await invoiceRepository.getInvoiceById(id)
    },
    addInvoice: async (amount, state) => {
        return await invoiceRepository.addInvoice(amount, state)
    }
}

module.exports = invoiceService