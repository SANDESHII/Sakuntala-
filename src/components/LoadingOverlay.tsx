import { FC } from 'react';

interface LoadingOverlayProps {
    loading: boolean;
}

export const LoadingOverlay: FC<LoadingOverlayProps> = ({ loading }) => (
    loading ? (
        <div className="fixed inset-0 z-[100] bg-neutral-950 flex flex-col items-center justify-center space-y-16">
            <div className="relative flex items-center justify-center">
                <div className="w-32 h-32 border border-neutral-900 rounded-full" />
                <div className="absolute inset-0 border-t border-white/20 rounded-full animate-spin [animation-duration:1.5s]" />
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-1 h-1 bg-white rounded-full animate-ping" />
                </div>
            </div>
            <div className="text-center space-y-6">
                <p className="text-[11px] font-black tracking-[0.3em] text-white uppercase">
                    Analyzing Match Data
                </p>
                <p className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest">
                    Processing...
                </p>
            </div>
        </div>
    ) : null
);
