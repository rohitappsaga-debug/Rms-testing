
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

export type CommandCode =
    | 'SUCCESS'
    | 'PERMISSION_DENIED'
    | 'NO_INTERNET'
    | 'PKG_MANAGER_MISSING'
    | 'INSTALL_FAILED'
    | 'UNKNOWN';

export interface CommandResult {
    ok: boolean;
    code: CommandCode;
    stdout: string;
    stderr: string;
    message: string;
}

type LogCallback = (data: string) => void;

/**
 * Reads the current .env file from disk and returns it as a key-value map.
 */
const getFreshEnv = (cwd: string): NodeJS.ProcessEnv => {
    const envPath = path.join(cwd, '.env');
    const freshEnv: NodeJS.ProcessEnv = { ...process.env };

    if (fs.existsSync(envPath)) {
        try {
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
        } catch (e) {
            // Fallback to current process.env if read fails
        }
    }

    return freshEnv;
};

/**
 * Robust shell command runner that captures output, masks secrets, 
 * and returns a structured result.
 */
export const runShellCommand = (
    command: string,
    args: string[],
    onLog?: LogCallback,
    cwd: string = process.cwd()
): Promise<CommandResult> => {
    return new Promise((resolve) => {
        const child = spawn(command, args, {
            shell: true,
            cwd,
            env: getFreshEnv(cwd),
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
            const chunk = data.toString();
            stdout += chunk;
            if (onLog) onLog(sanitizeLog(chunk));
        });

        child.stderr.on('data', (data) => {
            const chunk = data.toString();
            stderr += chunk;
            if (onLog) onLog(sanitizeLog(chunk));
        });

        child.on('close', (code) => {
            const ok = code === 0;
            let resultCode: CommandCode = ok ? 'SUCCESS' : 'INSTALL_FAILED';

            // Map common error patterns to codes
            const combinedOutput = (stdout + stderr).toLowerCase();
            if (!ok) {
                if (combinedOutput.includes('permission denied') ||
                    combinedOutput.includes('access is denied') ||
                    combinedOutput.includes('administrator') ||
                    combinedOutput.includes('requires elevation')) {
                    resultCode = 'PERMISSION_DENIED';
                } else if (combinedOutput.includes('not found') ||
                    combinedOutput.includes('is not recognized')) {
                    // This could be PKG_MANAGER_MISSING if we are running a manager
                    // But we'll let the caller decide or refine based on command
                }
            }

            resolve({
                ok,
                code: resultCode,
                stdout: sanitizeLog(stdout),
                stderr: sanitizeLog(stderr),
                message: ok ? 'Command completed successfully' : `Command failed with exit code ${code}`
            });
        });

        child.on('error', (err) => {
            resolve({
                ok: false,
                code: 'UNKNOWN',
                stdout: sanitizeLog(stdout),
                stderr: sanitizeLog(stderr),
                message: err.message
            });
        });
    });
};

const sanitizeLog = (log: string): string => {
    // Regex to match sensitive patterns
    // 1. Database URLs: postgres://user:pass@host...
    const dbUrlRegex = /(postgres(?:ql)?:\/\/[^:]+:)([^@/]+)(@)/g;

    // 2. Generic Key-Value secrets (KEY=VALUE)
    const secretKeyRegex = /((?:SECRET|PASSWORD|KEY|TOKEN|CREDENTIALS|AUTH|API_?KEY)[^=]*=)([^ \n\r\t,]+)/gi;

    // 3. Quoted passwords in command lines or flags
    const quotedPassRegex = /(--password[= ]|pass[= ]|pwd[= ]|--auth-token[= ])(["']?)([^"'\s]+)(\2)/gi;

    return log
        .replace(dbUrlRegex, '$1******$3')
        .replace(secretKeyRegex, '$1******')
        .replace(quotedPassRegex, '$1$2******$4');
};
