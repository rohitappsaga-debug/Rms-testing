
import { useState, useEffect } from 'react';
import { Database, Plus, Loader2, AlertCircle, ArrowRight } from 'lucide-react';
import { checkDbStatus, configureDb, installDb } from '../../api';

export default function DatabaseStep({ onNext }: { onNext: () => void }) {
    const [status, setStatus] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [installing, setInstalling] = useState(false);
    const [config, setConfig] = useState({
        host: 'localhost',
        port: 5432,
        user: 'postgres',
        password: '',
        database: 'restaurant_db',
        rootUser: 'postgres',
        rootPassword: ''
    });
    const [connError, setConnError] = useState('');
    const [testing, setTesting] = useState(false);

    useEffect(() => {
        checkDbStatus().then(res => {
            setStatus(res.data);
            setLoading(false);
        });
    }, []);

    const handleInstall = async () => {
        setInstalling(true);
        try {
            const res = await installDb();
            setStatus(res.data);
        } catch (err) {
            // Handle specific error codes if needed
        } finally {
            setInstalling(false);
        }
    };

    const handleConfigure = async () => {
        setTesting(true);
        setConnError('');
        try {
            await configureDb(config);
            onNext(); // Proceed if success
        } catch (err: any) {
            setConnError(err.response?.data?.details || err.message);
        } finally {
            setTesting(false);
        }
    };

    if (loading) return <div className="text-center py-12"><Loader2 className="animate-spin mx-auto text-blue-500" /></div>;

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <h2 className="text-2xl font-bold">Database Setup</h2>

            {/* Detection Status */}
            <div className={`p-4 rounded-lg border ${status?.installed ? 'bg-green-900/20 border-green-800' : 'bg-yellow-900/20 border-yellow-800'}`}>
                <div className="flex items-center">
                    <Database className={`mr-3 ${status?.installed ? "text-green-500" : "text-yellow-500"}`} />
                    <div>
                        <p className="font-semibold text-white">
                            {status?.installed ? `PostgreSQL Detected (${status.version})` : 'PostgreSQL Not Found'}
                        </p>
                        <p className="text-sm text-gray-400">
                            {status?.installed ? 'You can connect to this instance.' : 'We can try to install it for you, or you can use an external database.'}
                        </p>
                    </div>
                </div>

                {!status?.installed && (
                    <div className="mt-4 pl-9">
                        <button
                            onClick={handleInstall}
                            disabled={installing}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm flex items-center"
                        >
                            {installing ? <Loader2 className="animate-spin mr-2" size={16} /> : <Plus className="mr-2" size={16} />}
                            Auto-Install PostgreSQL
                        </button>
                    </div>
                )}
            </div>

            {/* Configuration Form */}
            <div className="bg-gray-800 p-6 rounded-lg space-y-4">
                <h3 className="font-medium text-white mb-4">Connection Details</h3>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Host</label>
                        <input
                            type="text"
                            value={config.host}
                            onChange={e => setConfig({ ...config, host: e.target.value })}
                            className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white focus:border-blue-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Port</label>
                        <input
                            type="number"
                            value={config.port}
                            onChange={e => setConfig({ ...config, port: parseInt(e.target.value) })}
                            className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white focus:border-blue-500 outline-none"
                        />
                    </div>
                </div>

                <div className="border-t border-gray-700 pt-4 mt-4">
                    <p className="text-sm text-gray-400 mb-4">Application User (will be created if not exists)</p>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">Username</label>
                            <input
                                type="text"
                                value={config.user}
                                onChange={e => setConfig({ ...config, user: e.target.value })}
                                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white focus:border-blue-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">Password</label>
                            <input
                                type="password"
                                value={config.password}
                                onChange={e => setConfig({ ...config, password: e.target.value })}
                                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white focus:border-blue-500 outline-none"
                                placeholder="Set a secure password"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">Database Name</label>
                            <input
                                type="text"
                                value={config.database}
                                onChange={e => setConfig({ ...config, database: e.target.value })}
                                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white focus:border-blue-500 outline-none"
                            />
                        </div>
                    </div>
                </div>

                <div className="border-t border-gray-700 pt-4 mt-4 bg-gray-800/50">
                    <div className="flex items-start mb-2">
                        <AlertCircle size={16} className="text-blue-400 mt-0.5 mr-2" />
                        <p className="text-xs text-blue-300">
                            To automatically create the database and user, provide credentials for a
                            superuser (e.g. 'postgres'). Leave blank if using pre-created credentials.
                        </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">Root Username (Optional)</label>
                            <input
                                type="text"
                                value={config.rootUser}
                                onChange={e => setConfig({ ...config, rootUser: e.target.value })}
                                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white focus:border-blue-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">Root Password (Optional)</label>
                            <input
                                type="password"
                                value={config.rootPassword}
                                onChange={e => setConfig({ ...config, rootPassword: e.target.value })}
                                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white focus:border-blue-500 outline-none"
                            />
                        </div>
                    </div>
                </div>

                {connError && (
                    <div className="bg-red-900/20 p-3 rounded text-red-200 text-sm border border-red-800">
                        {connError}
                    </div>
                )}

                <div className="flex justify-end pt-2">
                    <button
                        onClick={handleConfigure}
                        disabled={testing}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg flex items-center"
                    >
                        {testing ? <Loader2 className="animate-spin mr-2" size={18} /> : null}
                        Next <ArrowRight size={18} className="ml-2" />
                    </button>
                </div>
            </div>
        </div>
    );
}
