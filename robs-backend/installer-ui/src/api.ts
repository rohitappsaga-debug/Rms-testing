
import axios from 'axios';

const api = axios.create({
    baseURL: '/api/install',
});

/**
 * Check system requirements.
 * Cache-Control: no-store ensures every call (including Re-check) hits the
 * server fresh and never returns a stale result from a browser/proxy cache.
 */
export const checkSystem = () =>
    api.get('/check', { headers: { 'Cache-Control': 'no-store' } });

export const checkDbStatus = () => api.get('/database/status');
export const installDb = () => api.post('/database/install');
export const configureDb = (config: any) => api.post('/database/configure', config);
export const saveSettings = (settings: any) => api.post('/settings', settings);

export default api;
