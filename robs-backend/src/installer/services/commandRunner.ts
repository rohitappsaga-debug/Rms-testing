
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

type LogCallback = (data: string) => void;

/**
 * Reads the current .env file from disk and returns it as a key-value map.
 * This ensures child processes always get the most up-to-date credentials,
 * even if the installer wrote a new DATABASE_URL after the server started.
 */
const getFreshEnv = (cwd: string): NodeJS.ProcessEnv => {
    const envPath = path.join(cwd, '.env');
    const freshEnv: NodeJS.ProcessEnv = { ...process.env };

    if (fs.existsSync(envPath)) {
        const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx > 0) {
                const key = trimmed.substring(0, eqIdx).trim();
                const val = trimmed.substring(eqIdx + 1).trim();
                freshEnv[key] = val;
            }
        }
    }

    return freshEnv;
};

export const runShellCommand = (
    command: string,
    args: string[],
    onLog: LogCallback,
    cwd: string = process.cwd()
): Promise<void> => {
    return new Promise((resolve, reject) => {
        // Always pass fresh env so installer-written credentials are visible
        const child = spawn(command, args, {
            shell: true,
            cwd,
            env: getFreshEnv(cwd),
        });

        child.stdout.on('data', (data) => {
            onLog(sanitizeLog(data.toString()));
        });

        child.stderr.on('data', (data) => {
            onLog(sanitizeLog(data.toString()));
        });

        child.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Command failed with code ${code}`));
            }
        });

        child.on('error', (err) => {
            reject(err);
        });
    });
};

const sanitizeLog = (log: string): string => {
    // Regex to match sensitive patterns
    // 1. Database URLs: postgres://user:pass@host...
    const dbUrlRegex = /(postgres(?:ql)?:\/\/[^:]+:)([^@]+)(@)/g;

    // 2. Generic Key-Value secrets (KEY=VALUE)
    // Matches common secret keys like SECRET, PASSWORD, KEY, TOKEN
    const secretKeyRegex = /((?:SECRET|PASSWORD|KEY|TOKEN|CREDENTIALS)[^=]*=)([^ \n\r]+)/gi;

    return log
        .replace(dbUrlRegex, '$1******$3')
        .replace(secretKeyRegex, '$1******');
};
