
import fs from 'fs';
import path from 'path';
import { Client } from 'pg';
import 'dotenv/config';

const LOCK_FILE = path.join(process.cwd(), 'installed.lock');
const ENV_FILE = path.join(process.cwd(), '.env');
const ENV_EXAMPLE = path.join(process.cwd(), '.env.example');

async function resetApp() {
    console.log('🚀 Starting Application Reset...');

    // 1. Delete installed.lock
    if (fs.existsSync(LOCK_FILE)) {
        console.log('🗑️  Deleting installed.lock...');
        fs.unlinkSync(LOCK_FILE);
    } else {
        console.log('ℹ️  installed.lock not found, skipping.');
    }

    // 2. Drop Database (Optional/Best Effort)
    // We try to connect to 'postgres' DB using credentials from current .env if available
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
        try {
            console.log('⚡ Attempting to drop existing database...');
            // Parse user/pass from current URL to connect to 'postgres' system DB
            const url = new URL(dbUrl);
            const databaseName = url.pathname.split('/')[1]?.split('?')[0];

            if (databaseName) {
                const client = new Client({
                    connectionString: dbUrl.replace(`/${databaseName}`, '/postgres')
                });

                await client.connect();
                // Close other connections to the DB first
                await client.query(`
                    SELECT pg_terminate_backend(pg_stat_activity.pid)
                    FROM pg_stat_activity
                    WHERE pg_stat_activity.datname = $1
                      AND pid <> pg_backend_pid();
                `, [databaseName]);

                await client.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
                console.log(`✅ Database "${databaseName}" dropped successfully.`);
                await client.end();
            }
        } catch (error: any) {
            console.warn(`⚠️  Could not drop database: ${error.message}`);
            console.log('   (This is fine if you plan to manually delete it or if it doesn\'t exist)');
        }
    }

    // 3. Reset .env
    if (fs.existsSync(ENV_EXAMPLE)) {
        console.log('📝 Resetting .env from .env.example...');
        fs.copyFileSync(ENV_EXAMPLE, ENV_FILE);
        console.log('✅ .env reset to defaults.');
    } else {
        console.error('❌ .env.example not found! Cannot reset .env.');
    }

    console.log('\n✨ Reset complete! You can now start the backend and access the installer at port 3005.');
    console.log('Run: npm run dev');
}

resetApp().catch(err => {
    console.error('❌ Reset failed:', err);
    process.exit(1);
});
