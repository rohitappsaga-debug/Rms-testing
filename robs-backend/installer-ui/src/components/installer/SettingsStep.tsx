
import { useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { saveSettings } from '../../api';

export default function SettingsStep({ onNext }: { onNext: () => void }) {
    const [loading, setLoading] = useState(false);
    // Separate states for clarity, or one object
    const [form, setForm] = useState({
        appName: 'Restaurant System',
        appUrl: 'http://localhost:3000',
        adminEmail: 'admin@example.com',
        adminPassword: '',
        pusherAppId: '',
        pusherKey: '',
        pusherSecret: '',
        pusherCluster: 'mt1'
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await saveSettings(form);
            onNext();
        } catch (err) {
            alert('Failed to save settings');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold mb-6">Application Settings</h2>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="bg-gray-800 p-6 rounded-lg space-y-4">
                    <h3 className="font-medium text-white pb-2 border-b border-gray-700">General Settings</h3>

                    <div className="grid grid-cols-2 gap-4">
                        <Input label="App Name" value={form.appName} onChange={(v: string) => setForm({ ...form, appName: v })} />
                        <Input label="App URL" value={form.appUrl} onChange={(v: string) => setForm({ ...form, appUrl: v })} />
                    </div>
                </div>

                <div className="bg-gray-800 p-6 rounded-lg space-y-4">
                    <h3 className="font-medium text-white pb-2 border-b border-gray-700">Admin Account</h3>
                    <p className="text-xs text-gray-400">will be created as the initial super-admin</p>

                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Admin Email" type="email" value={form.adminEmail} onChange={(v: string) => setForm({ ...form, adminEmail: v })} />
                        <Input label="Admin Password" type="password" value={form.adminPassword} onChange={(v: string) => setForm({ ...form, adminPassword: v })} />
                    </div>
                </div>

                <div className="bg-gray-800 p-6 rounded-lg space-y-4">
                    <div className="flex justify-between items-center pb-2 border-b border-gray-700">
                        <h3 className="font-medium text-white">Pusher Settings (Optional)</h3>
                        <a href="https://pusher.com" target="_blank" className="text-xs text-blue-400 hover:underline">Get Credentials</a>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Input label="App ID" value={form.pusherAppId} onChange={(v: string) => setForm({ ...form, pusherAppId: v })} />
                        <Input label="Key" value={form.pusherKey} onChange={(v: string) => setForm({ ...form, pusherKey: v })} />
                        <Input label="Secret" value={form.pusherSecret} onChange={(v: string) => setForm({ ...form, pusherSecret: v })} type="password" />
                        <Input label="Cluster" value={form.pusherCluster} onChange={(v: string) => setForm({ ...form, pusherCluster: v })} />
                    </div>
                </div>

                <div className="flex justify-end pt-4">
                    <button
                        type="submit"
                        disabled={loading || !form.adminPassword}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg flex items-center"
                    >
                        {loading ? <Loader2 className="animate-spin mr-2" size={18} /> : null}
                        Next <ArrowRight size={18} className="ml-2" />
                    </button>
                </div>
            </form>
        </div>
    );
}

function Input({ label, value, onChange, type = "text" }: any) {
    return (
        <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">{label}</label>
            <input
                type={type}
                value={value}
                onChange={e => onChange(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white focus:border-blue-500 outline-none"
            />
        </div>
    )
}
