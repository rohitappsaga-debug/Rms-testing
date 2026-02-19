
import fs from 'fs';
import path from 'path';

const ENV_PATH = path.join(process.cwd(), '.env');
const ENV_BAK_PATH = path.join(process.cwd(), '.env.bak');
const ENV_TMP_PATH = path.join(process.cwd(), '.env.tmp');

export const writeEnv = async (envVars: Record<string, string>) => {
    // 1. Read existing .env if present
    let currentEnvContent = '';
    if (fs.existsSync(ENV_PATH)) {
        currentEnvContent = fs.readFileSync(ENV_PATH, 'utf-8');

        // Create backup if not exists
        if (!fs.existsSync(ENV_BAK_PATH)) {
            fs.copyFileSync(ENV_PATH, ENV_BAK_PATH);
        }
    }

    // 2. Parse current env to preserve comments and layout? 
    // For simplicity and robustness, we will append or replace specific keys 
    // but keeping a dictionary approach is safer for the installer flow.
    // We'll parse the existing file into a map to preserve other manual keys.

    const envMap = parseEnv(currentEnvContent);

    // 3. Update with new values
    Object.keys(envVars).forEach(key => {
        envMap.set(key, envVars[key]);
    });

    // 4. Construct new content
    let newContent = '';
    envMap.forEach((value, key) => {
        newContent += `${key}=${value}\n`;
    });

    // 5. Atomic Write
    fs.writeFileSync(ENV_TMP_PATH, newContent);
    fs.renameSync(ENV_TMP_PATH, ENV_PATH);
};

const parseEnv = (content: string): Map<string, string> => {
    const map = new Map<string, string>();
    const lines = content.split('\n');
    lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;

        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
            const key = trimmed.substring(0, eqIdx).trim();
            const val = trimmed.substring(eqIdx + 1).trim();
            map.set(key, val);
        }
    });
    return map;
};
