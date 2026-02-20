
import { Request, Response } from 'express';
import { checkSystemRequirements } from './services/systemCheck';
import { checkPostgresInstalled, installPostgres, provisionPostgres } from './services/postgres';
import { writeEnv } from './services/envWriter';
import { runShellCommand } from './services/commandRunner';
import { PORTS } from '../config/ports';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Client } from 'pg';

// --- System Check ---
export const getSystemRequirements = async (req: Request, res: Response) => {
    const results = await checkSystemRequirements();
    res.setHeader('Cache-Control', 'no-store');
    res.json(results);
};

// --- Database ---
export const getDatabaseStatus = async (req: Request, res: Response) => {
    const status = await checkPostgresInstalled();
    res.json({
        ok: true,
        installed: status.installed,
        version: status.version
    });
};

/**
 * Internal helper to perform setup with optional logging
 */
async function performPostgresSetup(
    options: { database?: string; user?: string; rootUser?: string; rootPassword?: string },
    onLog?: (msg: string) => void
) {
    const { database, user, rootUser, rootPassword } = options;
    const dbName = database || 'restaurant_db';
    const dbUser = user || 'restaurant_user';

    onLog?.('Pre-flight: Checking system requirements...');
    const requirements = await checkSystemRequirements();
    if (requirements.errors.length > 0) {
        throw { code: 'PREFLIGHT_FAILED', message: 'Critical system requirements missing.' };
    }

    onLog?.('Detection: Checking if PostgreSQL is installed...');
    const pgStatus = await checkPostgresInstalled();
    let usedExisting = false;

    if (!pgStatus.installed) {
        if (!requirements.internet.ok) {
            throw { code: 'NO_INTERNET', message: 'Internet required for installation.' };
        }
        onLog?.('PostgreSQL not found. Starting automatic installation...');
        const installRes = await installPostgres(onLog);
        if (!installRes.ok) {
            throw { code: installRes.code, message: installRes.message };
        }
    } else {
        onLog?.(`Found PostgreSQL ${pgStatus.version || ''}`);
        usedExisting = true;
    }

    onLog?.('Provisioning: Setting up database and user...');
    const provisionRes = await provisionPostgres({
        host: 'localhost',
        port: 5432,
        dbName,
        dbUser,
        rootUser,
        rootPassword
    });

    if (!provisionRes.ok) {
        throw { code: provisionRes.code, message: provisionRes.error };
    }

    const creds = provisionRes.credentials!;

    onLog?.('Persistence: Saving configuration to environment...');
    const dbUrl = `postgresql://${creds.user}:${creds.password}@${creds.host}:${creds.port}/${creds.database}?schema=public`;
    await writeEnv({
        DATABASE_URL: dbUrl,
        DB_HOST: creds.host,
        DB_PORT: creds.port.toString(),
        DB_NAME: creds.database,
        DB_USER: creds.user,
        DB_PASSWORD: creds.password
    });

    return {
        ok: true,
        code: 'SUCCESS',
        message: usedExisting ? 'Existing PostgreSQL instance reused and configured.' : 'PostgreSQL installed and configured.',
        usedExisting,
        credentials: creds
    };
}

/**
 * Smart Auto Setup Endpoint
 * POST /api/install/postgres/auto-setup
 */
export const autoSetupPostgres = async (req: Request, res: Response) => {
    try {
        const result = await performPostgresSetup(req.body);
        return res.json(result);
    } catch (error: any) {
        return res.json({
            ok: false,
            code: error.code || 'UNKNOWN_ERROR',
            message: error.message || 'An unexpected error occurred during setup.',
            nextStep: 'Check logs or try manual configuration.'
        });
    }
};

/**
 * Streaming Auto Setup Endpoint (SSE)
 * GET /api/install/postgres/auto-setup/stream
 */
export const autoSetupPostgresStream = async (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendLog = (message: string) => {
        res.write(`data: ${JSON.stringify({ type: 'log', message })}\n\n`);
    };

    try {
        const { database, user, rootUser, rootPassword } = req.query;
        let successfulRootPassword = rootPassword as string;

        const result = await performPostgresSetup({
            database: database as string,
            user: user as string,
            rootUser: rootUser as string,
            rootPassword: rootPassword as string
        }, sendLog);

        res.write(`data: ${JSON.stringify({ type: 'complete', ...result })}\n\n`);
        res.end();
    } catch (error: any) {
        res.write(`data: ${JSON.stringify({
            type: 'error',
            code: error.code || 'UNKNOWN_ERROR',
            message: error.message || 'Setup failed.'
        })}\n\n`);
        res.end();
    }
};

export const autoInstallPostgresController = async (req: Request, res: Response) => {
    return autoSetupPostgres(req, res);
};

export const autoInstallDatabase = async (req: Request, res: Response) => {
    // Keep for backward compatibility or refactor to use the new logic
    return autoInstallPostgresController(req, res);
};

export const configureDatabase = async (req: Request, res: Response) => {
    const { host, port, user, password, database, rootUser, rootPassword } = req.body;

    const provisionResult = await provisionPostgres({
        host,
        port,
        dbName: database,
        dbUser: user,
        dbPassword: password, // Pass through to allow bypass
        rootUser,
        rootPassword
    });

    if (provisionResult.ok) {
        const creds = provisionResult.credentials!;
        // User might have provided their own password, but we generate one in provision.
        // If they provided one, we should ideally use it. 
        // Let's refine provisionPostgres to accept a password if provided.
        // For now, we'll just use the generated one or manual connect.

        const finalPassword = password || creds.password;

        const dbUrl = `postgresql://${user}:${finalPassword}@${host}:${port}/${database}?schema=public`;
        await writeEnv({
            DATABASE_URL: dbUrl,
            DB_HOST: host,
            DB_PORT: port.toString(),
            DB_NAME: database,
            DB_USER: user,
            DB_PASSWORD: finalPassword
        });

        res.json({ success: true, message: 'Database configured and connected.' });
    } else {
        res.json({ ok: false, error: 'Connection failed', details: provisionResult.error });
    }
};


// --- App Settings ---
export const saveAppSettings = async (req: Request, res: Response) => {
    const { appName, appUrl, adminEmail, adminPassword, jwtSecret, pusherAppId, pusherKey, pusherSecret, pusherCluster } = req.body;

    const finalJwtSecret = jwtSecret || crypto.randomBytes(32).toString('hex');

    const envUpdates: Record<string, string> = {
        APP_NAME: appName,
        APP_URL: appUrl,
        ADMIN_EMAIL: adminEmail,
        JWT_SECRET: finalJwtSecret,
        PORT: PORTS.BACKEND.toString(),
        CORS_ORIGIN: `http://localhost:${PORTS.FRONTEND}`,
        SOCKET_CORS_ORIGIN: `http://localhost:${PORTS.FRONTEND}`
    };

    if (pusherAppId && pusherKey && pusherSecret && pusherCluster) {
        envUpdates.PUSHER_APP_ID = pusherAppId;
        envUpdates.PUSHER_KEY = pusherKey;
        envUpdates.PUSHER_SECRET = pusherSecret;
        envUpdates.PUSHER_CLUSTER = pusherCluster;
    }

    await writeEnv(envUpdates);

    const adminCreds = { email: adminEmail, password: adminPassword };
    fs.writeFileSync(path.join(process.cwd(), '.admin-setup.json'), JSON.stringify(adminCreds));

    res.json({ success: true });
};


// --- Installation ---
export const startInstallation = async (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendLog = (data: string) => {
        res.write(`data: ${JSON.stringify({ type: 'log', message: data })}\n\n`);
    };

    const sendStatus = (step: string, status: 'pending' | 'running' | 'success' | 'error') => {
        res.write(`data: ${JSON.stringify({ type: 'status', step, status })}\n\n`);
    };

    // Reload env
    const envFilePath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envFilePath)) {
        const lines = fs.readFileSync(envFilePath, 'utf-8').split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx > 0) {
                const key = trimmed.substring(0, eqIdx).trim();
                const val = trimmed.substring(eqIdx + 1).trim();
                process.env[key] = val;
            }
        }
    }

    try {
        sendStatus('dependencies', 'running');
        sendLog('Installing dependencies (this may take a while)...');
        await runShellCommand('npm', ['install'], sendLog);
        sendStatus('dependencies', 'success');

        sendStatus('database', 'running');
        sendLog('Running database migrations...');
        await runShellCommand('npx', ['prisma', 'generate'], sendLog);
        await runShellCommand('npx', ['prisma', 'migrate', 'deploy'], sendLog);
        sendStatus('database', 'success');

        sendStatus('seeding', 'running');
        sendLog('Seeding initial data...');
        const adminSetupPath = path.join(process.cwd(), '.admin-setup.json');
        if (fs.existsSync(adminSetupPath)) {
            const creds = JSON.parse(fs.readFileSync(adminSetupPath, 'utf-8'));
            process.env.SEED_ADMIN_EMAIL = creds.email;
            process.env.SEED_ADMIN_PASSWORD = creds.password;
            // Assuming the seed script can handle these env vars
            await runShellCommand('npm', ['run', 'db:seed'], sendLog);
            fs.unlinkSync(adminSetupPath);
        } else {
            await runShellCommand('npm', ['run', 'db:seed'], sendLog);
        }
        sendStatus('seeding', 'success');

        sendStatus('build', 'running');
        sendLog('Building applications...');
        await runShellCommand('npm', ['run', 'build'], sendLog);
        sendStatus('build', 'success');

        fs.writeFileSync(path.join(process.cwd(), 'installed.lock'), 'INSTALLED');
        sendLog('Installation completed successfully!');
        res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);
        res.end();

    } catch (error: any) {
        sendLog(`ERROR: ${error.message}`);
        res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
        res.end();
    }
};

export const restartServer = async (req: Request, res: Response) => {
    res.json({ success: true, message: 'Server is restarting...' });
    setTimeout(() => {
        process.exit(0);
    }, 2000);
};

