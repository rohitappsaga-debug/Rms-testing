
import { CheckCircle2 } from 'lucide-react';

export default function FinishStep({ }: { onNext: () => void }) {
    return (
        <div className="max-w-xl mx-auto text-center py-12">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-green-900/20 text-green-500 mb-6">
                <CheckCircle2 size={48} />
            </div>

            <h2 className="text-3xl font-bold text-white mb-4">Installation Complete!</h2>

            <p className="text-gray-400 mb-8 leading-relaxed">
                The Restaurant Order Booking System has been successfully installed and configured.
                You can now restart the server to switch to Production mode.
            </p>

            <div className="bg-gray-800 p-6 rounded-lg text-left mb-8">
                <h3 className="font-semibold text-white mb-2">Next Steps:</h3>
                <ol className="list-decimal list-inside text-gray-300 space-y-2">
                    <li>Restart the backend server (e.g. <code className="bg-black px-1 rounded">npm run start</code> or via PM2)</li>
                    <li>Navigate to the Admin Panel</li>
                    <li>Log in with the credentials you configured</li>
                </ol>
            </div>

            <div className="flex justify-center space-x-4">
                {/* In a real scenario, we might trigger a restart via API, but manual is safer */}
                <button
                    className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium"
                    onClick={() => window.open('/', '_self')}
                >
                    Go to Home
                </button>
            </div>
        </div>
    );
}
