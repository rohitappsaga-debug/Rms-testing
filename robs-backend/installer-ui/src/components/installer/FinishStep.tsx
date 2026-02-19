import { CheckCircle2, Loader2, Home, ExternalLink } from 'lucide-react';
import { useState, useEffect } from 'react';
import { restartInstaller } from '../../api';

export default function FinishStep({ }: { onNext: () => void }) {
    const [status, setStatus] = useState<'idle' | 'restarting' | 'checking' | 'ready'>('idle');

    const checkServerHealth = async () => {
        try {
            const response = await fetch('http://localhost:3000/health');
            if (response.ok) {
                return true;
            }
        } catch (err) {
            // Expected while server is down or restarting
        }
        return false;
    };

    const handleFinish = async () => {
        setStatus('restarting');
        try {
            await restartInstaller();
        } catch (err) {
            console.error('Restart API call failed (expected if server shut down fast):', err);
        }

        // Wait a few seconds for the setup script to catch the exit and start production
        setTimeout(() => {
            setStatus('checking');
        }, 5000);
    };

    useEffect(() => {
        let interval: any;

        if (status === 'checking') {
            interval = setInterval(async () => {
                const isUp = await checkServerHealth();
                if (isUp) {
                    setStatus('ready');
                    clearInterval(interval);
                }
            }, 3000);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [status]);

    const redirectToApp = () => {
        window.location.href = 'http://localhost:3000';
    };

    return (
        <div className="max-w-xl mx-auto text-center py-12">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-green-900/20 text-green-500 mb-6">
                {(status === 'restarting' || status === 'checking') ? (
                    <Loader2 size={48} className="animate-spin" />
                ) : (
                    <CheckCircle2 size={48} />
                )}
            </div>

            <h2 className="text-3xl font-bold text-white mb-4">
                {status === 'idle' && 'Installation Complete!'}
                {status === 'restarting' && 'Restarting System...'}
                {status === 'checking' && 'Connecting to App...'}
                {status === 'ready' && 'Everything is Ready!'}
            </h2>

            <p className="text-gray-400 mb-8 leading-relaxed">
                {status === 'idle' && 'The Restaurant Order Booking System has been successfully installed and configured. Press the button below to start the application.'}
                {status === 'restarting' && 'The installer is shutting down and handing over to the production server...'}
                {status === 'checking' && 'Waiting for the production server to start on port 3000. This should take just a few seconds.'}
                {status === 'ready' && 'The production server is now live! You can now access your restaurant dashboard.'}
            </p>

            {status === 'idle' && (
                <div className="bg-gray-800 p-6 rounded-lg text-left mb-8 shadow-xl border border-gray-700">
                    <h3 className="font-semibold text-white mb-2">Final Step</h3>
                    <p className="text-gray-300">
                        Clicking "Finish" will stop this installer and launch the main application.
                        All builds were completed during the previous step.
                    </p>
                </div>
            )}

            <div className="flex justify-center space-x-4">
                {status === 'idle' && (
                    <button
                        className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium flex items-center gap-2 transition-all"
                        onClick={handleFinish}
                    >
                        <Home size={20} />
                        Finish & Start App
                    </button>
                )}

                {(status === 'restarting' || status === 'checking') && (
                    <div className="flex items-center gap-3 text-blue-400 font-medium bg-blue-900/20 px-6 py-3 rounded-lg border border-blue-800/50">
                        <Loader2 size={20} className="animate-spin" />
                        {status === 'restarting' ? 'Stopping Installer...' : 'Checking Port 3000...'}
                    </div>
                )}

                {status === 'ready' && (
                    <button
                        className="px-8 py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium flex items-center gap-2 shadow-lg shadow-green-900/20 animate-bounce"
                        onClick={redirectToApp}
                    >
                        <ExternalLink size={20} />
                        Open Dashboard
                    </button>
                )}
            </div>
        </div>
    );
}
