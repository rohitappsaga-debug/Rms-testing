
import { useState, useEffect, useRef } from 'react';
import { Database, Plus, Loader2, AlertCircle, ArrowRight, CheckCircle2, ShieldAlert, WifiOff, Terminal, Search, Info } from 'lucide-react';
import { getPgStatus, configureDb } from '../../api';

interface AutoInstallResult {
    ok: boolean;
    code: string;
    message: string;
    details?: string;
    nextStep?: string;
    credentials?: any;
}

export default function DatabaseStep({ onNext }: { onNext: () => void }) {
    const [status, setStatus] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [installing, setInstalling] = useState(false);
    const [installResult, setInstallResult] = useState<AutoInstallResult | null>(null);
    const [logs, setLogs] = useState<string[]>([]);
    const logEndRef = useRef<HTMLDivElement>(null);

    const [config, setConfig] = useState({
        host: 'localhost',
        port: 5432,
        user: 'restaurant_user',
        password: '',
        database: 'restaurant_db',
        rootUser: 'postgres',
        rootPassword: ''
    });

    const [connError, setConnError] = useState('');
    const [testing, setTesting] = useState(false);

    const refreshStatus = () => {
        setLoading(true);
        getPgStatus().then(res => {
            setStatus(res.data);
            setLoading(false);
        }).catch(() => setLoading(false));
    };

    useEffect(() => {
        refreshStatus();
    }, []);

    // Proactive Auto-Setup: 
    // If PostgreSQL is detected and we haven't tried setup yet, do it automatically.
    useEffect(() => {
        if (status?.installed && !installResult && !installing && !loading) {
            handleAutoInstall();
        }
    }, [status, loading]);

    // Auto-scroll logs
    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    const handleAutoInstall = async () => {
        setInstalling(true);
        setInstallResult(null);
        setConnError('');
        setLogs(['[SYSTEM] Starting auto-setup sequence...']);

        const params = new URLSearchParams({
            database: config.database,
            user: config.user,
            rootUser: config.rootUser,
            rootPassword: config.rootPassword
        });

        const eventSource = new EventSource(`/api/install/postgres/auto-setup/stream?${params.toString()}`);

        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.type === 'log') {
                setLogs(prev => [...prev, data.message]);
            } else if (data.type === 'complete') {
                eventSource.close();
                setInstalling(false);
                const result: AutoInstallResult = data;
                setInstallResult(result);

                if (result.ok && result.credentials) {
                    const creds = result.credentials;
                    setConfig(prev => ({
                        ...prev,
                        host: creds.host,
                        port: creds.port,
                        user: creds.user,
                        password: creds.password,
                        database: creds.database,
                        rootUser: creds.rootUser || prev.rootUser,
                        rootPassword: creds.rootPassword || prev.rootPassword
                    }));
                    setStatus({ installed: true, version: 'Auto-provisioned' });
                }
            } else if (data.type === 'error') {
                eventSource.close();
                setInstalling(false);
                setInstallResult({
                    ok: false,
                    code: data.code || 'UNKNOWN_ERROR',
                    message: data.message || 'Setup failed during streaming.'
                });
            }
        };

        eventSource.onerror = () => {
            eventSource.close();
            setInstalling(false);
            setInstallResult({
                ok: false,
                code: 'NETWORK_ERROR',
                message: 'Lost connection to installer backend.',
                nextStep: 'Ensure the backend server is running on port 3005.'
            });
        };
    };

    const handleConfigure = async () => {
        setTesting(true);
        setConnError('');
        try {
            await configureDb(config);
            onNext();
        } catch (err: any) {
            setConnError(err.response?.data?.details || err.message || 'Database connection failed.');
        } finally {
            setTesting(false);
        }
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
            <p className="text-gray-400">Scanning for database instances…</p>
        </div>
    );

    return (
        <div className="max-w-3xl mx-auto space-y-6 pb-12">
            <header>
                <h2 className="text-2xl font-bold text-white mb-2">Database Configuration</h2>
                <p className="text-gray-400">Set up PostgreSQL to store your restaurant's data.</p>
            </header>

            {/* 1. Detection & Auto-Install Card */}
            <div className={`p-5 rounded-xl border transition-all ${status?.installed
                ? 'bg-green-900/10 border-green-500/30'
                : installResult?.ok === false
                    ? 'bg-red-900/10 border-red-500/30'
                    : 'bg-blue-900/10 border-blue-500/30'
                }`}>
                <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg ${status?.installed ? 'bg-green-500/20' : 'bg-blue-500/20'}`}>
                        <Database className={status?.installed ? "text-green-400" : "text-blue-400"} size={24} />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                            <h3 className="text-lg font-semibold text-white">
                                {status?.installed ? 'PostgreSQL Ready' : 'One-Click Installer'}
                            </h3>
                            {status?.installed && (
                                <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs font-bold rounded border border-green-500/30">
                                    FOUND
                                </span>
                            )}
                        </div>
                        <p className="text-gray-400 text-sm mb-4 leading-relaxed">
                            {status?.installed
                                ? `Local instance detected (${status.version}). You can use it or provide different details below.`
                                : 'PostgreSQL is not installed or not running. We can automatically install, configure, and secure it for you.'}
                        </p>

                        {!installing && !installResult && (
                            <button
                                onClick={handleAutoInstall}
                                className="group flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold transition-all shadow-lg shadow-blue-900/40"
                            >
                                {status?.installed ? (
                                    <>
                                        <Search size={18} />
                                        <span>Auto-Setup Database</span>
                                    </>
                                ) : (
                                    <>
                                        <Plus size={18} className="group-hover:rotate-90 transition-transform" />
                                        <span>Install PostgreSQL Automatically</span>
                                    </>
                                )}
                            </button>
                        )}

                        {installing && (
                            <div className="flex flex-col gap-4 mt-2">
                                <div className="flex items-center gap-3 text-blue-400 font-medium">
                                    <Loader2 className="animate-spin" size={20} />
                                    <span>{status?.installed ? 'Provisioning Database...' : 'Installing & Provisioning PostgreSQL...'}</span>
                                </div>

                                <div className="bg-black/60 rounded-xl border border-blue-500/20 shadow-2xl overflow-hidden flex flex-col h-[200px]">
                                    <header className="bg-gray-900 px-3 py-1.5 border-b border-gray-800 flex items-center justify-between">
                                        <div className="flex gap-1.5">
                                            <div className="w-2.5 h-2.5 rounded-full bg-red-500/50"></div>
                                            <div className="w-2.5 h-2.5 rounded-full bg-amber-500/50"></div>
                                            <div className="w-2.5 h-2.5 rounded-full bg-green-500/50"></div>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-mono">
                                            <Terminal size={12} />
                                            <span>setup.log</span>
                                        </div>
                                    </header>

                                    <div className="flex-1 overflow-y-auto p-4 font-mono text-[11px] leading-relaxed scrollbar-thin scrollbar-thumb-gray-800">
                                        {logs.map((log, i) => (
                                            <div key={i} className="flex gap-2 mb-1 group">
                                                <span className="text-gray-600 select-none">{i + 1}</span>
                                                <span className={log.startsWith('[ERROR]') ? 'text-red-400' : log.startsWith('[SYSTEM]') ? 'text-blue-400' : 'text-gray-300'}>
                                                    {log}
                                                </span>
                                            </div>
                                        ))}
                                        {installing && (
                                            <div className="flex gap-2 items-center text-blue-400/60 animate-pulse">
                                                <span>{'>'}</span>
                                                <div className="w-1.5 h-3 bg-blue-400/60"></div>
                                            </div>
                                        )}
                                        <div ref={logEndRef} />
                                    </div>

                                    <footer className="bg-black/30 px-4 py-2 flex items-center gap-2 border-t border-gray-800/50">
                                        <Info size={12} className="text-blue-500" />
                                        <span className="text-[10px] text-gray-500 italic">This may take a moment. Please don't refresh.</span>
                                    </footer>
                                </div>
                            </div>
                        )}

                        {/* Error Handling Cards */}
                        {installResult && !installResult.ok && (
                            <div className="space-y-4">
                                <div className={`flex items-start gap-3 p-4 rounded-lg border ${installResult.code === 'AUTH_FAILED'
                                    ? 'text-amber-400 bg-amber-950/20 border-amber-500/20'
                                    : 'text-red-400 bg-red-950/20 border-red-500/20'}`}>
                                    {installResult.code === 'AUTH_FAILED' ? <ShieldAlert className="mt-1 flex-shrink-0" /> : <WifiOff className="mt-1 flex-shrink-0" />}
                                    <div className="flex-1">
                                        <p className="font-bold mb-1">{installResult.message}</p>
                                        <p className="text-xs opacity-70 mb-3">{installResult.details || installResult.nextStep}</p>

                                        {installResult.code === 'AUTH_FAILED' && (
                                            <div className="mb-4 space-y-3">
                                                <div className="grid grid-cols-2 gap-3">
                                                    <input
                                                        type="text"
                                                        placeholder="Root User (e.g. postgres)"
                                                        value={config.rootUser}
                                                        onChange={e => setConfig({ ...config, rootUser: e.target.value })}
                                                        className="bg-black/40 border border-amber-500/20 rounded p-1.5 text-xs text-white outline-none"
                                                    />
                                                    <input
                                                        type="password"
                                                        placeholder="Root Password"
                                                        value={config.rootPassword}
                                                        onChange={e => setConfig({ ...config, rootPassword: e.target.value })}
                                                        className="bg-black/40 border border-amber-500/20 rounded p-1.5 text-xs text-white outline-none"
                                                    />
                                                </div>
                                                <button
                                                    onClick={handleAutoInstall}
                                                    className="w-full bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold py-2 rounded transition-colors"
                                                >
                                                    Authenticate & Provision
                                                </button>
                                            </div>
                                        )}

                                        <div className="flex gap-3">
                                            {installResult.code !== 'AUTH_FAILED' && (
                                                <button
                                                    onClick={handleAutoInstall}
                                                    className="text-xs bg-red-500 text-white px-3 py-1.5 rounded hover:bg-red-400 font-bold"
                                                >
                                                    Retry Auto-Setup
                                                </button>
                                            )}
                                            <button
                                                onClick={() => setInstallResult(null)}
                                                className="text-xs bg-gray-700 text-white px-3 py-1.5 rounded hover:bg-gray-600"
                                            >
                                                Manual Setup
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Success Feedback */}
                        {installResult?.ok && (
                            <div className="flex items-center gap-3 text-green-400 bg-green-950/20 p-4 rounded-lg border border-green-500/20">
                                <CheckCircle2 />
                                <div>
                                    <p className="font-bold text-sm">{installResult.message}</p>
                                    <p className="text-[11px] text-green-300/70">Credentials have been auto-filled in the form below.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 2. Manual Configuration Form (Always visible or toggleable) */}
            <div className={`transition-opacity ${installing ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                <div className="bg-gray-800/40 border border-gray-700 rounded-xl overflow-hidden">
                    <div className="p-6 space-y-6">
                        <header className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-white">Connection Details</h3>
                            <span className="text-xs text-gray-500">Configure manually if needed</span>
                        </header>

                        <div className="grid grid-cols-5 gap-4">
                            <div className="col-span-3">
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Host</label>
                                <input
                                    type="text"
                                    value={config.host}
                                    onChange={e => setConfig({ ...config, host: e.target.value })}
                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all"
                                />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Port</label>
                                <input
                                    type="number"
                                    value={config.port}
                                    onChange={e => setConfig({ ...config, port: parseInt(e.target.value) })}
                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div className="pt-2">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="h-px bg-gray-700 flex-1"></div>
                                <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest px-2">Application Credentials</span>
                                <div className="h-px bg-gray-700 flex-1"></div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2 sm:col-span-1">
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Database Name</label>
                                    <input
                                        type="text"
                                        value={config.database}
                                        onChange={e => setConfig({ ...config, database: e.target.value })}
                                        className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-white focus:border-blue-500 outline-none"
                                    />
                                </div>
                                <div className="col-span-2 sm:col-span-1">
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Username</label>
                                    <input
                                        type="text"
                                        value={config.user}
                                        onChange={e => setConfig({ ...config, user: e.target.value })}
                                        className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-white focus:border-blue-500 outline-none"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Password</label>
                                    <input
                                        type="password"
                                        value={config.password}
                                        onChange={e => setConfig({ ...config, password: e.target.value })}
                                        className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-white focus:border-blue-500 outline-none"
                                        placeholder="Enter password or auto-install above"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Root Credentials Section (Collapsible or subtle) */}
                        {!status?.installed && (
                            <div className="mt-4 p-4 bg-gray-900/50 rounded-lg border border-gray-700/50">
                                <div className="flex items-start gap-2 mb-4">
                                    <ShieldAlert size={14} className="text-amber-500 mt-1" />
                                    <p className="text-[11px] text-gray-400">
                                        If already installed, provide superuser (e.g. 'postgres') credentials to automatically provision the database and user.
                                    </p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Root User</label>
                                        <input
                                            type="text"
                                            value={config.rootUser}
                                            onChange={e => setConfig({ ...config, rootUser: e.target.value })}
                                            className="w-full bg-gray-800 border-none rounded p-2 text-sm text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Root Password</label>
                                        <input
                                            type="password"
                                            value={config.rootPassword}
                                            onChange={e => setConfig({ ...config, rootPassword: e.target.value })}
                                            className="w-full bg-gray-800 border-none rounded p-2 text-sm text-white"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {connError && (
                            <div className="flex gap-3 bg-red-900/20 p-4 rounded-xl border border-red-500/30 text-red-200 text-sm">
                                <AlertCircle className="flex-shrink-0" size={20} />
                                <p>{connError}</p>
                            </div>
                        )}
                    </div>

                    <div className="bg-gray-900/50 px-6 py-4 flex items-center justify-between border-t border-gray-700">
                        <button
                            onClick={refreshStatus}
                            className="text-gray-500 hover:text-white text-xs transition-colors"
                        >
                            ↻ Detect Again
                        </button>
                        <button
                            onClick={handleConfigure}
                            disabled={testing || (!config.password && !installResult?.ok)}
                            className="group flex items-center gap-3 px-8 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-900/20"
                        >
                            {testing ? <Loader2 className="animate-spin" size={20} /> : <span>Test & Continue</span>}
                            <ArrowRight className="group-hover:translate-x-1 transition-transform" size={20} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
