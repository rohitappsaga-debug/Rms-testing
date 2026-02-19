
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { checkInstallerLock } from './middleware';
import { checkSystemRequirements } from './services/systemCheck';
import { PORTS } from '../config/ports';

import installerRoutes from './routes';

export const startInstallerServer = async () => {
    const app = express();

    // The installer ALWAYS binds to PORTS.INSTALLER (3005).
    // This is fixed — no dynamic resolution needed, no risk of stealing
    // PORTS.BACKEND (3000) and making the system-check report a false positive.
    const installerPort = PORTS.INSTALLER;

    app.use(cors());
    app.use(express.json());

    // Serve static files for the installer UI build
    app.use(express.static(path.join(__dirname, 'public')));

    // API Routes
    app.use('/api/install', installerRoutes);

    // Catch-all: serve index.html for SPA routing
    app.get('*', (req, res) => {
        if (req.path.startsWith('/api')) {
            return res.status(404).json({ error: 'API endpoint not found' });
        }

        const checkFile = path.join(__dirname, 'public', 'index.html');
        if (fs.existsSync(checkFile)) {
            res.sendFile(checkFile);
        } else {
            res.send(`
            <html>
                <head>
                    <title>Installer Mode</title>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background-color: #f0f2f5; margin: 0; }
                        .card { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; max-width: 400px; }
                        h1 { color: #1a1a1a; margin-bottom: 1rem; }
                        p { color: #4a4a4a; margin-bottom: 2rem; }
                        .code { background: #eee; padding: 0.2rem 0.4rem; border-radius: 4px; font-family: monospace; }
                    </style>
                </head>
                <body>
                    <div class="card">
                        <h1>Installer Mode Active</h1>
                        <p>The system is running in installer mode.</p>
                        <p>However, the installer UI build was not found in <br><span class="code">src/installer/public</span></p>
                        <p>Please build the installer UI first: <span class="code">npm run build:installer</span></p>
                    </div>
                </body>
            </html>
        `);
        }
    });

    app.listen(installerPort, () => {
        console.log('\n');
        console.log('      ╔═══════════════════════════════════════╗');
        console.log('      ║        🚀 INSTALLER MODE STARTED      ║');
        console.log('      ╠═══════════════════════════════════════╣');
        console.log(`      ║  Installer UI : http://localhost:${installerPort}  ║`);
        console.log(`      ║  Backend Port : ${PORTS.BACKEND} (will be checked)     ║`);
        console.log(`      ║  Frontend Port: ${PORTS.FRONTEND} (Vite dev server)   ║`);
        console.log('      ╚═══════════════════════════════════════╝');
        console.log('\n');
    });
};
