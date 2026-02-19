
import os from 'os';
import fs from 'fs';
import path from 'path';
import net from 'net';
import { PORTS } from '../../config/ports';

export interface PortCheckResult {
    value: number;
    status: 'free' | 'busy';
    message: string;
}

export interface SystemCheckResult {
    nodeVersion: string;
    platform: string;
    diskSpace: {
        free: number;
        total: number;
    };
    hasWriteAccess: boolean;
    port: PortCheckResult;
    errors: string[];   // Blocking errors (node version, disk, permissions)
    warnings: string[]; // Non-blocking warnings
}

export const checkSystemRequirements = async (): Promise<SystemCheckResult> => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Node.js version check
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0], 10);
    if (majorVersion < 18) {
        errors.push(`Node.js version must be >= 18. Current version is ${nodeVersion}.`);
    }

    // 2. Disk space proxy (RAM as approximation; proper disk check needs external lib)
    const freeMem = os.freemem();
    const totalMem = os.totalmem();

    // 3. Write access check
    let hasWriteAccess = false;
    try {
        const testFile = path.join(process.cwd(), '.write-test');
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        hasWriteAccess = true;
    } catch {
        errors.push('No write access to current directory.');
    }

    // 4. Port check — BACKEND port only (3000).
    //
    //    The installer runs on PORTS.INSTALLER (3005) — never checked here.
    //    The frontend runs on PORTS.FRONTEND (3002) — not required for install.
    //    Only PORTS.BACKEND (3000) must be free so the app can start after install.
    const portFree = await probePort(PORTS.BACKEND);
    const port: PortCheckResult = {
        value: PORTS.BACKEND,
        status: portFree ? 'free' : 'busy',
        message: portFree
            ? `Port ${PORTS.BACKEND} is free`
            : `Port ${PORTS.BACKEND} is in use by another process`,
    };

    return {
        nodeVersion,
        platform: os.platform(),
        diskSpace: { free: freeMem, total: totalMem },
        hasWriteAccess,
        port,
        errors,
        warnings,
    };
};

/**
 * Reliable port availability check via TCP bind-probe.
 *
 * Returns true  → port is free  (bind succeeded; socket immediately closed).
 * Returns false → port is busy  (EADDRINUSE) or otherwise unusable.
 *
 * Does NOT use netstat / lsof parsing and is not fooled by TIME_WAIT sockets.
 */
const probePort = (port: number): Promise<boolean> =>
    new Promise((resolve) => {
        const server = net.createServer();
        server.once('error', () => resolve(false));
        server.once('listening', () => server.close(() => resolve(true)));
        server.listen(port, '0.0.0.0');
    });
