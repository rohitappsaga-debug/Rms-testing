
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

console.log('DEBUG: Imports complete. Starting application...');
console.log('DEBUG: Checking for installed.lock...');


// Define lock file path
const LOCK_FILE = path.join(process.cwd(), 'installed.lock');

// Check if application is installed
if (!fs.existsSync(LOCK_FILE)) {
  // Installer Mode
  console.log('Checking for installed.lock... NOT FOUND. Starting Installer Mode.');
  import('./installer/server').then(({ startInstallerServer }) => {
    startInstallerServer();
  }).catch(err => {
    console.error('Failed to start installer:', err);
    process.exit(1);
  });
} else {
  // Main Application Mode
  console.log('Checking for installed.lock... FOUND. Starting Main Application.');

  // Dynamic import of the main application to avoid side effects (DB connection, etc.) 
  // running during installer mode
  import('./main').catch(err => {
    console.error('Failed to start main application:', err);
    process.exit(1);
  });
}
