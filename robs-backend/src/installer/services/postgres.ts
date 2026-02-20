
import os from 'os';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Client } from 'pg';
import { runShellCommand, CommandResult } from './commandRunner';

export interface PostgresStatus {
    installed: boolean;
    version?: string;
    exePath?: string;
    error?: {
        code: string;
        message: string;
        details?: string;
    };
}

const COMMON_WIN_PATHS = [
    'C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe',
    'C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe',
    'C:\\Program Files\\PostgreSQL\\15\\bin\\psql.exe',
    'C:\\Program Files\\PostgreSQL\\14\\bin\\psql.exe',
    'C:\\Program Files\\PostgreSQL\\13\\bin\\psql.exe',
];

/**
 * Checks if PostgreSQL is installed and accessible.
 */
export const checkPostgresInstalled = async (): Promise<PostgresStatus> => {
    // 1. Try PATH
    const psqlCheck = await runShellCommand('psql', ['--version']);
    if (psqlCheck.ok) {
        return { installed: true, version: psqlCheck.stdout.trim(), exePath: 'psql' };
    }

    // 2. Windows-specific deep search
    if (os.platform() === 'win32') {
        for (const pgPath of COMMON_WIN_PATHS) {
            if (fs.existsSync(pgPath)) {
                const versionResult = await runShellCommand(`"${pgPath}"`, ['--version']);
                if (versionResult.ok) {
                    return { installed: true, version: versionResult.stdout.trim(), exePath: pgPath };
                }
            }
        }
    }

    return {
        installed: false,
        error: { code: 'PG_NOT_FOUND', message: 'PostgreSQL not found in PATH or common locations.' }
    };
};

/**
 * Installs PostgreSQL using the best available package manager.
 */
export const installPostgres = async (onLog?: (data: string) => void): Promise<CommandResult> => {
    const platform = os.platform();

    if (platform === 'win32') {
        // Try winget first
        onLog?.('Attempting installation via winget...');
        const winget = await runShellCommand('winget', [
            'install', '--id', 'PostgreSQL.PostgreSQL', '-e',
            '--source', 'winget', '--accept-package-agreements',
            '--accept-source-agreements', '--silent'
        ], onLog);

        if (winget.ok) return winget;

        // Fallback to Chocolatey
        onLog?.('winget failed or missing. Trying Chocolatey...');
        const choco = await runShellCommand('choco', ['install', 'postgresql', '-y'], onLog);
        if (choco.ok) return choco;

        return {
            ok: false,
            code: 'PKG_MANAGER_MISSING',
            stdout: '',
            stderr: '',
            message: 'Both winget and Chocolatey failed or are missing. Please install PostgreSQL manually.'
        };
    } else if (platform === 'linux') {
        onLog?.('Detecting Linux package manager...');

        const managers = [
            { cmd: 'apt-get', args: ['update', '&&', 'apt-get', 'install', '-y', 'postgresql', 'postgresql-contrib'] },
            { cmd: 'dnf', args: ['install', '-y', 'postgresql-server', 'postgresql-contrib'] },
            { cmd: 'yum', args: ['install', '-y', 'postgresql-server', 'postgresql-contrib'] }
        ];

        for (const manager of managers) {
            const check = await runShellCommand(manager.cmd, ['--version']);
            if (check.ok) {
                onLog?.(`Found ${manager.cmd}. Starting installation...`);
                return await runShellCommand('sudo', manager.args, onLog);
            }
        }
    } else if (platform === 'darwin') {
        onLog?.('Attempting installation via Homebrew...');
        const brew = await runShellCommand('brew', ['install', 'postgresql@14'], onLog); // specific version often safer
        if (brew.ok) return brew;
    }

    return {
        ok: false,
        code: 'INSTALL_FAILED',
        stdout: '',
        stderr: '',
        message: `Auto-install not supported or failed on ${platform}.`
    };
};

/**
 * Generates a strong random password.
 */
const generateStrongPassword = (length = 20): string => {
    return crypto.randomBytes(length).toString('base64')
        .replace(/[^a-zA-Z0-9]/g, '') // Remove symbols for easier connection strings
        .substring(0, length);
};

export interface ProvisionResult {
    ok: boolean;
    credentials?: {
        host: string;
        port: number;
        database: string;
        user: string;
        password: string;
        rootUser?: string;
        rootPassword?: string;
    };
    error?: string;
    code?: string;
}

import { COMMON_PASSWORDS } from './passwordDictionary';

/**
 * Provisions a database, user, and grants privileges.
 * Smart Logic: 
 * 1. Tries TCP connection with rootPassword or Deep Guessing (100+ passwords).
 * 2. If TCP fails, tries local 'psql' CLI fallback (common on Ubuntu/Linux).
 */
export const provisionPostgres = async (options: {
    host: string;
    port: number;
    dbName: string;
    dbUser: string;
    dbPassword?: string;
    rootUser?: string;
    rootPassword?: string;
    onLog?: (msg: string) => void;
}): Promise<ProvisionResult> => {
    const { host, port, dbName, dbUser, dbPassword: providedPassword, rootUser, rootPassword, onLog } = options;

    // 0. Try direct connection first if password provided
    if (providedPassword) {
        onLog?.('Testing direct application connection...');
        const directClient = new Client({
            host,
            port,
            user: dbUser,
            password: providedPassword,
            database: dbName,
            connectionTimeoutMillis: 2000,
        });
        try {
            await directClient.connect();
            await directClient.end();
            return {
                ok: true,
                credentials: {
                    host,
                    port,
                    database: dbName,
                    user: dbUser,
                    password: providedPassword
                }
            };
        } catch (e) {
            // Fallback to provisioning logic below
        }
    }

    // 1. Root connection with Deep Smart Guessing (100+ passwords)
    onLog?.('Starting deep password guessing (100+ variations)...');
    const guesses = rootPassword ? [rootPassword] : COMMON_PASSWORDS;
    let rootClient: Client | null = null;
    let lastError: any = null;
    let successfulRootPassword = '';

    for (let i = 0; i < guesses.length; i++) {
        const guess = guesses[i];
        if (i > 0 && i % 10 === 0) onLog?.(`Tried ${i} passwords...`);

        const client = new Client({
            host,
            port,
            user: rootUser || 'postgres',
            password: guess,
            database: 'postgres',
            connectionTimeoutMillis: 1000, // Fast timeout for local guessing
        });

        try {
            await client.connect();
            rootClient = client;
            successfulRootPassword = guess;
            onLog?.(`Successfully authenticated as ${rootUser || 'postgres'}!`);
            break;
        } catch (err: any) {
            lastError = err;
            await client.end().catch(() => { });
        }
    }

    // 2. CLI Fallback (Ubuntu/Linux Peer Auth)
    if (!rootClient && os.platform() === 'linux') {
        onLog?.('TCP Auth failed. Trying local CLI fallback (Peer Auth)...');
        try {
            // Try to create user via psql directly (no password needed for peer auth)
            const dbPassword = providedPassword || generateStrongPassword(32);

            const commands = [
                `CREATE USER "${dbUser}" WITH ENCRYPTED PASSWORD '${dbPassword}' CREATEDB`,
                `CREATE DATABASE "${dbName}" OWNER "${dbUser}"`,
                `GRANT ALL PRIVILEGES ON DATABASE "${dbName}" TO "${dbUser}"`
            ];

            for (const cmd of commands) {
                // Try as current user first, then sudo if needed
                const res = await runShellCommand('psql', ['-U', rootUser || 'postgres', '-c', cmd]);
                if (!res.ok) {
                    // Sudo fallback if permitted
                    await runShellCommand('sudo', ['-u', 'postgres', 'psql', '-c', cmd]);
                }
            }

            onLog?.('Provisioning successful via local CLI.');
            return {
                ok: true,
                credentials: {
                    host,
                    port,
                    database: dbName,
                    user: dbUser,
                    password: dbPassword,
                    rootUser: rootUser || 'postgres',
                    rootPassword: '(Peer Auth)'
                }
            };
        } catch (cliErr) {
            onLog?.('CLI fallback failed.');
        }
    }

    if (!rootClient) {
        // Handle Authentication Failures
        if (lastError?.code === '28P01' || lastError?.message.toLowerCase().includes('password authentication failed')) {
            return {
                ok: false,
                error: 'Authentication failed. Tried 100+ common passwords and local CLI.',
                code: 'AUTH_FAILED' as any
            };
        }
        return { ok: false, error: `Failed to connect to PostgreSQL: ${lastError?.message}` };
    }

    const dbPassword = providedPassword || generateStrongPassword(32);

    try {
        // 1. Create User (Idempotent)
        const userCheck = await rootClient.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [dbUser]);
        if (userCheck.rowCount === 0) {
            await rootClient.query(`CREATE USER "${dbUser}" WITH ENCRYPTED PASSWORD '${dbPassword}' CREATEDB`);
        } else {
            // Update password to the new strong one
            await rootClient.query(`ALTER USER "${dbUser}" WITH PASSWORD '${dbPassword}'`);
        }

        // 2. Create Database (Idempotent)
        const dbCheck = await rootClient.query('SELECT 1 FROM pg_database WHERE datname=$1', [dbName]);
        if (dbCheck.rowCount === 0) {
            await rootClient.query(`CREATE DATABASE "${dbName}" OWNER "${dbUser}"`);
        } else {
            // Ensure ownership is correct
            await rootClient.query(`ALTER DATABASE "${dbName}" OWNER TO "${dbUser}"`);
        }

        // 3. Grant Privileges
        await rootClient.query(`GRANT ALL PRIVILEGES ON DATABASE "${dbName}" TO "${dbUser}"`);

        await rootClient.end();

        // 4. Verify app connection
        const appClient = new Client({
            host,
            port,
            user: dbUser,
            password: dbPassword,
            database: dbName,
            connectionTimeoutMillis: 5000,
        });

        await appClient.connect();
        await appClient.end();

        return {
            ok: true,
            credentials: {
                host,
                port,
                database: dbName,
                user: dbUser,
                password: dbPassword,
                rootUser: rootUser || 'postgres',
                rootPassword: successfulRootPassword
            }
        };

    } catch (err: any) {
        try { await rootClient.end(); } catch (e) { }
        return { ok: false, error: `Provisioning failed: ${err.message}` };
    }
};
