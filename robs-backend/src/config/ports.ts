/**
 * ╔═══════════════════════════════════════════════╗
 * ║         SINGLE SOURCE OF TRUTH — PORTS        ║
 * ╚═══════════════════════════════════════════════╝
 *
 * Each service has exactly ONE port. Change it here only.
 *
 *   BACKEND   → 3000  (Express API, Socket.io)
 *   FRONTEND  → 3002  (Vite / React dev server)
 *   INSTALLER → 3005  (Installer UI + Installer API)
 *
 * The installer system-check probes PORTS.BACKEND only —
 * that is the port the application will need after install.
 * It never checks its own port (INSTALLER) or the frontend (FRONTEND).
 */
export const PORTS = {
    /** Express/Node backend API — what the app listens on after install */
    BACKEND: 3000,
    /** React/Vite frontend dev server */
    FRONTEND: 3002,
    /** Web-based installer UI + its API server */
    INSTALLER: 3005,
} as const;

export type PortName = keyof typeof PORTS;
