import mysql from 'mysql2/promise';

// MySQL connection pool configuration
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: 'hippo-capital',
    pool: { max: 2, min: 0, acquire: 10000, idle: 10000 },
    charset: 'utf8mb4'
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

console.log('MySQL connection pool created and ready');

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Closing database connection pool...');
    await pool.end();
    process.exit(0);
});


process.on('SIGTERM', async () => {
    console.log('Closing database connection pool...');
    await pool.end();
    process.exit(0);
});

export default pool;
