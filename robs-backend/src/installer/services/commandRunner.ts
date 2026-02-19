
import { spawn } from 'child_process';

type LogCallback = (data: string) => void;

export const runShellCommand = (
    command: string,
    args: string[],
    onLog: LogCallback,
    cwd: string = process.cwd()
): Promise<void> => {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, { shell: true, cwd });

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
