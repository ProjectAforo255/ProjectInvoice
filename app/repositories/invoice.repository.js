const { Pool } = require('pg')

const pool = new Pool({
    user: process.env.DB_POSTGRES_USER,
    password: process.env.DB_POSTGRES_PASSWORD,
    database: process.env.DB_POSTGRES_DATABASE_INVOICE,
    host: process.env.DB_POSTGRES_HOST,
    port: process.env.DB_POSTGRES_PORT,
    ssl: { 
        rejectUnauthorized: !Boolean(process.env.DB_POSTGRES_REJECTUNAUTHORIZED),
    },
    dialect: process.env.DB_POSTGRES_DIALECT,
})

const invoiceRepository = {
    getInvoces: async () => {
        var results = await pool.query('SELECT * FROM invoice')
        return results.rows
    },
    getInvoiceById: async (id) => {
        var results = await pool.query('SELECT * FROM invoice WHERE id = $1', [id])
        return results.rows
    },
    addInvoice: async (amount, state) => {
        var results = await pool.query('INSERT INTO invoice (amount, state) VALUES ($1, $2) RETURNING *', [amount, state])
        return results.rows
    }
}

module.exports = invoiceRepository;