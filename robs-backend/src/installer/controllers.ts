
import { Request, Response } from 'express';
import { checkSystemRequirements } from './services/systemCheck';
import { checkPostgresInstalled, installPostgres } from './services/postgres';
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
    // Prevent caching so Re-check always reflects the real current state
    res.setHeader('Cache-Control', 'no-store');
    res.json(results);
};

// --- Database ---
export const getDatabaseStatus = async (req: Request, res: Response) => {
    const status = await checkPostgresInstalled();
    res.json(status);
};

export const autoInstallDatabase = async (req: Request, res: Response) => {
    // This is a long running process, but we'll await it for simplicity for now.
    // In a real app, SSE might be better, but install is usually blocking.
    const status = await installPostgres();
    if (status.installed) {
        res.json(status);
    } else {
        res.status(500).json(status);
    }
};

export const configureDatabase = async (req: Request, res: Response) => {
    const { host, port, user, password, database, rootUser, rootPassword } = req.body;

    // 1. Verify connection
    // If root credentials provided, create user/db
    // If only user credentials, test connection

    if (rootUser && rootPassword) {
        // Create DB and User mode
        const client = new Client({
            host,
            port,
            user: rootUser,
            password: rootPassword,
            database: 'postgres' // Connect to default DB
        });

        try {
            await client.connect();

            // Check if user exists
            const userCheck = await client.query(`SELECT 1 FROM pg_roles WHERE rolname=$1`, [user]);
            if (userCheck.rowCount === 0) {
                await client.query(`CREATE USER "${user}" WITH ENCRYPTED PASSWORD '${password}' CREATEDB`);
            }

            // Check if db exists
            const dbCheck = await client.query(`SELECT 1 FROM pg_database WHERE datname=$1`, [database]);
            if (dbCheck.rowCount === 0) {
                await client.query(`CREATE DATABASE "${database}" OWNER "${user}"`);
            }

            await client.end();
        } catch (error: any) {
            return res.status(400).json({ error: 'Failed to configure database with root credentials', details: error.message });
        }
    }

    // Test final connection
    const appClient = new Client({ host, port, user, password, database });
    try {
        await appClient.connect();
        await appClient.end();

        // Save to .env
        const dbUrl = `postgresql://${user}:${password}@${host}:${port}/${database}?schema=public`;
        await writeEnv({ DATABASE_URL: dbUrl });

        res.json({ success: true, message: 'Database configured and connected.' });
    } catch (error: any) {
        res.status(400).json({ error: 'Connection failed', details: error.message });
    }
};


// --- App Settings ---
export const saveAppSettings = async (req: Request, res: Response) => {
    const { appName, appUrl, adminEmail, adminPassword, jwtSecret, pusherAppId, pusherKey, pusherSecret, pusherCluster } = req.body;

    // Generate secure secrets if not provided
    const finalJwtSecret = jwtSecret || crypto.randomBytes(32).toString('hex');

    const envUpdates: Record<string, string> = {
        APP_NAME: appName,
        APP_URL: appUrl,
        ADMIN_EMAIL: adminEmail,
        // We don't store admin password in env, it's for seeding
        JWT_SECRET: finalJwtSecret,
        PORT: PORTS.BACKEND.toString()
    };

    if (pusherAppId && pusherKey && pusherSecret && pusherCluster) {
        envUpdates.PUSHER_APP_ID = pusherAppId;
        envUpdates.PUSHER_KEY = pusherKey;
        envUpdates.PUSHER_SECRET = pusherSecret;
        envUpdates.PUSHER_CLUSTER = pusherCluster;
    }

    await writeEnv(envUpdates);

    // We should allow seeding the admin user later or store it locally to seed during install step
    // For now, we'll write a temp file with admin creds for the seed script to pick up?
    // Or better, pass it to the seed command (safely).

    const adminCreds = { email: adminEmail, password: adminPassword };
    fs.writeFileSync(path.join(process.cwd(), '.admin-setup.json'), JSON.stringify(adminCreds));

    res.json({ success: true });
};


// --- Installation ---
export const startInstallation = async (req: Request, res: Response) => {
    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendLog = (data: string) => {
        res.write(`data: ${JSON.stringify({ type: 'log', message: data })}\n\n`);
    };

    const sendStatus = (step: string, status: 'pending' | 'running' | 'success' | 'error') => {
        res.write(`data: ${JSON.stringify({ type: 'status', step, status })}\n\n`);
    };

    try {
        // 1. Install Dependencies
        sendStatus('dependencies', 'running');
        sendLog('Installing dependencies (this may take a while)...');
        await runShellCommand('npm', ['install'], sendLog);
        sendStatus('dependencies', 'success');

        // 2. Database Migration
        sendStatus('database', 'running');
        sendLog('Running database migrations...');
        // Need to run prisma generate first
        await runShellCommand('npx', ['prisma', 'generate'], sendLog);
        await runShellCommand('npx', ['prisma', 'migrate', 'deploy'], sendLog);
        sendStatus('database', 'success');

        // 3. Seed Admin
        sendStatus('seeding', 'running');
        sendLog('Seeding initial data...');
        const adminSetupPath = path.join(process.cwd(), '.admin-setup.json');
        if (fs.existsSync(adminSetupPath)) {
            // We need a custom seed script that reads this file? 
            // Or we inject env vars for the seed script.
            // Let's assume standard seed for now and we create admin manually via direct DB or script override
            // For robustness, I'll recommend a custom "seed-admin.ts" or similar.
            // Simplest: We run a specialized script.
            sendLog('Creating admin user...');
            const creds = JSON.parse(fs.readFileSync(adminSetupPath, 'utf-8'));
            // Pass creds via env vars to a one-off script
            process.env.SEED_ADMIN_EMAIL = creds.email;
            process.env.SEED_ADMIN_PASSWORD = creds.password;
            await runShellCommand('npx', ['ts-node', 'prisma/seed.ts'], sendLog);

            // Cleanup
            fs.unlinkSync(adminSetupPath);
        } else {
            await runShellCommand('npm', ['run', 'db:seed'], sendLog);
        }
        sendStatus('seeding', 'success');

        // 4. Build Frontend (if applicable) and Backend
        sendStatus('build', 'running');
        sendLog('Building application...');
        await runShellCommand('npm', ['run', 'build'], sendLog);
        sendStatus('build', 'success');

        // 5. Finalize
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
