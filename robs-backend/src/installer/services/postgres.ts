
import { spawn } from 'child_process';
import os from 'os';

export interface PostgresStatus {
    installed: boolean;
    version?: string;
    error?: {
        code: 'PG_NOT_FOUND' | 'PG_INSTALL_FAILED' | 'PERMISSION_DENIED' | 'UNKNOWN';
        message: string;
    };
}

export const checkPostgresInstalled = async (): Promise<PostgresStatus> => {
    try {
        const version = await runCommand('psql', ['--version']);
        return { installed: true, version: version.trim() };
    } catch (error) {
        return {
            installed: false,
            error: { code: 'PG_NOT_FOUND', message: 'PostgreSQL not found in PATH' }
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
