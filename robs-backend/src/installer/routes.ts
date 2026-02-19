
import { Router } from 'express';
import {
    getSystemRequirements,
    getDatabaseStatus,
    autoInstallDatabase,
    configureDatabase,
    saveAppSettings,
    startInstallation
} from './controllers';
import { checkInstallerLock } from './middleware';

const router = Router();

// Apply lock check to all installer routes
router.use(checkInstallerLock);

router.get('/check', getSystemRequirements);
router.get('/database/status', getDatabaseStatus);
router.post('/database/install', autoInstallDatabase);
router.post('/database/configure', configureDatabase);
router.post('/settings', saveAppSettings);
router.get('/install/run', startInstallation); // GET for SSE

export default router;
