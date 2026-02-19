
import { spawn, execSync } from 'child_process';
import os from 'os';
import fs from 'fs';
import path from 'path';

export interface PostgresStatus {
    installed: boolean;
    version?: string;
    exePath?: string;
    error?: {
        code: 'PG_NOT_FOUND' | 'PG_INSTALL_FAILED' | 'PERMISSION_DENIED' | 'UNKNOWN';
        message: string;
    };
}

const COMMON_WIN_PATHS = [
    'C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe',
    'C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe',
    'C:\\Program Files\\PostgreSQL\\15\\bin\\psql.exe',
    'C:\\Program Files\\PostgreSQL\\14\\bin\\psql.exe',
    'C:\\Program Files\\PostgreSQL\\13\\bin\\psql.exe',
];

export const checkPostgresInstalled = async (): Promise<PostgresStatus> => {
    // 1. Try simple 'psql' (PATH check)
    try {
        const version = await runCommand('psql', ['--version']);
        return { installed: true, version: version.trim(), exePath: 'psql' };
    } catch (error) {
        // 2. If not in PATH and on Windows, try common paths
        if (os.platform() === 'win32') {
            for (const pgPath of COMMON_WIN_PATHS) {
                if (fs.existsSync(pgPath)) {
                    try {
                        const version = await runCommand(`"${pgPath}"`, ['--version']);
                        return { installed: true, version: version.trim(), exePath: pgPath };
                    } catch (e) {
                        // Continue to next path
                    }
                }
            }

            // 3. Last ditch effort: try to find it using where or dir (expensive, but better than failing)
            try {
                const foundPath = execSync('where /R "C:\\Program Files\\PostgreSQL" psql.exe', { encoding: 'utf8' }).split('\n')[0]?.trim();
                if (foundPath && fs.existsSync(foundPath)) {
                    const version = await runCommand(`"${foundPath}"`, ['--version']);
                    return { installed: true, version: version.trim(), exePath: foundPath };
                }
            } catch (e) {
                // Ignore
            }
        }

        return {
            installed: false,
            error: { code: 'PG_NOT_FOUND', message: 'PostgreSQL not found in PATH or common locations' }
        };
    }
};

export const installPostgres = async (): Promise<PostgresStatus> => {
    const platform = os.platform();

    try {
        if (platform === 'win32') {
            // Try winget
            // Note: This requires shell execution and might trigger UAC or fail if not admin
            // We will try non-interactive install if possible
            await runCommand('winget', ['install', '--id', 'PostgreSQL.PostgreSQL', '-e', '--source', 'winget', '--accept-package-agreements', '--accept-source-agreements']);
            return checkPostgresInstalled();
        } else if (platform === 'linux') {
            // Try apt-get (requires sudo, might fail if no nopasswd sudo)
            await runCommand('sudo', ['apt-get', 'update']);
            await runCommand('sudo', ['apt-get', 'install', '-y', 'postgresql', 'postgresql-contrib']);
            return checkPostgresInstalled();
        } else {
            return {
                installed: false,
                error: { code: 'UNKNOWN', message: `Auto-install not supported on ${platform}` }
            };
        }
    } catch (error: any) {
        let code: PostgresStatus['error']['code'] = 'PG_INSTALL_FAILED';
        if (error.message.includes('elevation') || error.message.includes('permission') || error.message.includes('sudo')) {
            code = 'PERMISSION_DENIED';
        }
        return {
            installed: false,
            error: {
                code,
                message: error.message || 'Installation command failed'
            }
        };
    }
};

const runCommand = (command: string, args: string[]): Promise<string> => {
    return new Promise((resolve, reject) => {
        const process = spawn(command, args, { shell: true });
        let stdout = '';
        let stderr = '';

        process.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        process.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        process.on('close', (code) => {
            if (code === 0) {
                resolve(stdout);
            } else {
                reject(new Error(stderr || stdout || `Command exited with code ${code}`));
            }
        });

        process.on('error', (err) => {
            reject(err);
        });
    });
};
