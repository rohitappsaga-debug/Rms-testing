import { provisionPostgres } from '@/installer/services/postgres';
import { writeEnv } from '@/installer/services/envWriter';
import { logger } from '@/utils/logger';

/**
 * Parses a PostgreSQL connection string into its component parts.
 * Handles format: postgresql://user:password@host:port/database?schema=...
 */
const parseConnectionString = (url: string) => {
    try {
        const parsed = new URL(url);
        return {
            host: parsed.hostname || 'localhost',
            port: parseInt(parsed.port || '5432', 10),
            dbName: parsed.pathname.replace(/^\//, '').split('?')[0],
            dbUser: decodeURIComponent(parsed.username),
            dbPassword: decodeURIComponent(parsed.password),
        };
    } catch {
        return null;
    }
};

/**
 * Attempts to automatically heal a broken database connection.
 *
 * Called when the app detects a 28P01 (password authentication failed) error on startup.
 * Re-provisions the database user with a new password (or the same one) using the existing
 * provisionPostgres service, then updates the .env file with the corrected DATABASE_URL.
 *
 * @param databaseUrl The current DATABASE_URL that failed to authenticate.
 * @returns `true` if the heal was successful and .env was updated, `false` otherwise.
 */
export const autoHealDatabase = async (databaseUrl: string): Promise<boolean> => {
    logger.warn('⚠️  Auth failed — attempting automatic database self-heal...');

    const parsed = parseConnectionString(databaseUrl);
    if (!parsed) {
        logger.error('❌ Auto-heal: Could not parse DATABASE_URL. Cannot self-heal.');
        return false;
    }

    const { host, port, dbName, dbUser, dbPassword } = parsed;
    logger.warn(`⚠️  Auto-heal: Provisioning user "${dbUser}" on ${host}:${port}/${dbName}...`);

    const result = await provisionPostgres({
        host,
        port,
        dbName,
        dbUser,
        // Pass the existing password — if it still works, great.
        // If not, provisionPostgres will reset it to itself or generate a new one via peer-auth.
        dbPassword,
        onLog: (msg) => logger.info(`  [auto-heal] ${msg}`),
    });

    if (!result.ok || !result.credentials) {
        logger.error(`❌ Auto-heal failed: ${result.error || 'Unknown error'}`);
        logger.error('   Ensure PostgreSQL is running and accessible.');
        return false;
    }

    const { credentials } = result;
    const newDatabaseUrl =
        `postgresql://${credentials.user}:${credentials.password}@${credentials.host}:${credentials.port}/${credentials.database}?schema=public`;

    // Persist the corrected credentials to .env so future startups work too
    try {
        await writeEnv({ DATABASE_URL: newDatabaseUrl });
        logger.info('✅ Auto-heal: .env updated with corrected DATABASE_URL.');
    } catch (err: any) {
        logger.warn(`⚠️  Auto-heal: Could not update .env automatically: ${err.message}`);
        // Don't fail — the in-memory fix is still valid for this session
    }

    // Expose the healed URL so the caller can reinitialize the pool
    process.env.DATABASE_URL = newDatabaseUrl;

    logger.info('✅ Database self-heal successful! Retrying connection...');
    return true;
};
