
import { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, ArrowRight, RefreshCw, Loader2 } from 'lucide-react';
import { checkSystem } from '../../api';

// ─── API Response Types ────────────────────────────────────────────────────────

interface PortResult {
    /** The port that was probed — always PORTS.BACKEND (3000) */
    value: number;
    status: 'free' | 'busy';
    message: string;
}

interface SystemCheckResponse {
    nodeVersion: string;
    platform: string;
    hasWriteAccess: boolean;
    port: PortResult;
    errors: string[];
    warnings: string[];
}

// ─── Sub-components ────────────────────────────────────────────────────────────

interface RequirementItemProps {
    label: string;
    value: string;
    passed: boolean;
    isWarning?: boolean;
    detail?: string;
}

const RequirementItem = ({ label, value, passed, isWarning = false, detail }: RequirementItemProps) => (
    <div className="flex items-start justify-between py-3 border-b border-gray-700/50 last:border-0">
        <div className="flex-1">
            <span className="text-gray-300">{label}</span>
            {detail && (
                <p className={`text-sm mt-1 ${isWarning ? 'text-amber-400' : 'text-gray-400'}`}>
                    {detail}
                </p>
            )}
        </div>
        <div className="flex items-center gap-2 ml-4">
            <span className={`text-sm font-medium ${passed ? 'text-green-400' : isWarning ? 'text-amber-400' : 'text-red-400'}`}>
                {value}
            </span>
            {passed
                ? <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                : isWarning
                    ? <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                    : <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            }
        </div>
    </div>
);

// ─── Main Component ────────────────────────────────────────────────────────────

interface RequirementsStepProps {
    onNext: () => void;
}

export default function RequirementsStep({ onNext }: RequirementsStepProps) {
    const [loading, setLoading] = useState(true);
    const [rechecking, setRechecking] = useState(false);
    const [results, setResults] = useState<SystemCheckResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    const fetchRequirements = async (isRecheck = false) => {
        if (isRecheck) setRechecking(true);
        else setLoading(true);
        setError(null);

        try {
            const response = await checkSystem();
            setResults(response.data);
        } catch (err) {
            setError('Failed to check system requirements. Please ensure the installer server is running.');
        } finally {
            setLoading(false);
            setRechecking(false);
        }
    };

    useEffect(() => { fetchRequirements(); }, []);

    // ── Derived state ──────────────────────────────────────────────────────────

    const portFree = results?.port.status === 'free';
    const portValue = results?.port.value;   // Always 3000 (PORTS.BACKEND) — from API, never hardcoded
    const portLabel = portValue != null ? `Port ${portValue} (Backend API)` : 'Backend Port';

    // Blocking: node version errors, write access errors
    const hasBlockingErrors = (results?.errors?.length ?? 0) > 0;
    // Port busy = blocking (backend port must be free before install)
    const canProceed = !loading && !rechecking && !error && !hasBlockingErrors && portFree;

    // ── Loading ────────────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="w-12 h-12 text-blue-400 animate-spin mb-4" />
                <p className="text-gray-400">Checking system requirements…</p>
            </div>
        );
    }

    // ── Error ──────────────────────────────────────────────────────────────────

    if (error) {
        return (
            <div className="text-center py-12">
                <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">Check Failed</h3>
                <p className="text-gray-400 mb-6">{error}</p>
                <button
                    onClick={() => fetchRequirements(true)}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    Try Again
                </button>
            </div>
        );
    }

    // ── Results ────────────────────────────────────────────────────────────────

    return (
        <div>
            <h2 className="text-2xl font-bold text-white mb-2">System Requirements</h2>
            <p className="text-gray-400 mb-6">
                Verifying your environment before installation.
            </p>

            <div className="bg-gray-800/50 rounded-xl border border-gray-700 divide-y divide-gray-700/50 mb-6">
                {/* Node.js */}
                <RequirementItem
                    label="Node.js Version"
                    value={results?.nodeVersion ?? '—'}
                    passed={(results?.errors ?? []).every(e => !e.includes('Node.js'))}
                    detail="Required: >= v18"
                />

                {/* Platform */}
                <RequirementItem
                    label="Platform"
                    value={results?.platform ?? '—'}
                    passed={true}
                />

                {/* Write Access */}
                <RequirementItem
                    label="Write Permissions"
                    value={results?.hasWriteAccess ? 'Yes' : 'No'}
                    passed={results?.hasWriteAccess ?? false}
                    detail={!results?.hasWriteAccess ? 'Installer needs write access to create .env and lock files.' : undefined}
                />

                {/* Backend Port — the ONLY port shown here.
                    3005 = installer (already running, irrelevant).
                    3002 = frontend (not needed for install).
                    3000 = backend API (MUST be free for install to succeed). */}
                <RequirementItem
                    label={portLabel}
                    value={portFree ? 'Available' : 'Busy'}
                    passed={portFree}
                    isWarning={!portFree}
                    detail={
                        !portFree && portValue != null
                            ? `Port ${portValue} is already in use. Please stop the service using it and click Re-check.`
                            : portFree && portValue != null
                                ? `Port ${portValue} is available.`
                                : undefined
                    }
                />
            </div>

            {/* Issues Found */}
            {(hasBlockingErrors || !portFree) && (
                <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 mb-6">
                    <p className="text-red-400 font-semibold mb-2">Issues Found:</p>
                    <ul className="list-disc list-inside space-y-1">
                        {results?.errors?.map((err, i) => (
                            <li key={i} className="text-red-300 text-sm">{err}</li>
                        ))}
                        {!portFree && portValue != null && (
                            <li className="text-red-300 text-sm">
                                Port <strong>{portValue}</strong> is already in use.
                            </li>
                        )}
                    </ul>
                </div>
            )}

            {/* Warnings */}
            {(results?.warnings?.length ?? 0) > 0 && (
                <div className="bg-amber-900/20 border border-amber-500/30 rounded-xl p-4 mb-6">
                    <p className="text-amber-400 font-semibold mb-2">Warnings:</p>
                    <ul className="list-disc list-inside space-y-1">
                        {results?.warnings?.map((w, i) => (
                            <li key={i} className="text-amber-300 text-sm">{w}</li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Actions */}
            <div className="flex justify-between items-center">
                <button
                    onClick={() => fetchRequirements(true)}
                    disabled={rechecking}
                    className="flex items-center gap-2 px-4 py-2 text-gray-300 border border-gray-600 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                    {rechecking
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <RefreshCw className="w-4 h-4" />
                    }
                    Re-check
                </button>

                <button
                    onClick={onNext}
                    disabled={!canProceed}
                    className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Next
                    <ArrowRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
