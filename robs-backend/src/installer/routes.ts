
import { Router } from 'express';
import {
    getSystemRequirements,
    getDatabaseStatus,
    autoInstallDatabase,
    configureDatabase,
    saveAppSettings,
    startInstallation,
    restartServer
} from './controllers';
import { checkInstallerLock } from './middleware';

const router = Router();

// Restart route is allowed even if locked (it's the exit mechanism)
router.post('/restart', restartServer);

// Apply lock check to configuration routes
router.use(checkInstallerLock);

router.get('/check', getSystemRequirements);
router.get('/database/status', getDatabaseStatus);
router.post('/database/install', autoInstallDatabase);
router.post('/database/configure', configureDatabase);
router.post('/settings', saveAppSettings);
router.get('/install/run', startInstallation); // GET for SSE

export default router;
