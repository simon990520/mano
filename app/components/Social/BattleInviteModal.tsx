'use client';

import { useState, useEffect } from 'react';
import { Swords, X, Trophy, Coins, Gem } from 'lucide-react';

interface BattleInviteModalProps {
    challenge: {
        fromId: string;
        fromUsername: string;
        stakeTier: number;
        mode: 'casual' | 'ranked';
    } | null;
    onAccept: () => void;
    onDecline: () => void;
}

export const BattleInviteModal = ({ challenge, onAccept, onDecline }: BattleInviteModalProps) => {
    const [timeLeft, setTimeLeft] = useState(15);

    useEffect(() => {
        if (!challenge) {
            setTimeLeft(15);
            return;
        }

        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    onDecline();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [challenge]);

    if (!challenge) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="w-full max-w-sm bg-[#0f172a] border border-yellow-500/30 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(234,179,8,0.2)] animate-in zoom-in-95 duration-300">
                {/* Header/Banner */}
                <div className="h-24 bg-gradient-to-br from-yellow-500/20 to-amber-600/20 flex items-center justify-center relative border-b border-white/10">
                    <div className="absolute top-0 right-0 p-3">
                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-yellow-500 font-bold text-xs ring-2 ring-yellow-500/30">
                            {timeLeft}
                        </div>
                    </div>
                    <div className="p-4 bg-yellow-500 rounded-full shadow-lg shadow-yellow-500/20 animate-bounce-slow">
                        <Swords className="w-8 h-8 text-black" />
                    </div>
                </div>

                <div className="p-6 text-center">
                    <h2 className="text-xl font-black text-white uppercase tracking-tight mb-1">¡Nuevo Desafío!</h2>
                    <p className="text-white/60 text-sm mb-6">
                        <span className="text-yellow-500 font-bold">@{challenge.fromUsername}</span> te ha retado a una batalla.
                    </p>

                    <div className="grid grid-cols-2 gap-3 mb-8">
                        <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                            <div className="text-[10px] text-white/40 uppercase font-black mb-1">Apuesta</div>
                            <div className="flex items-center justify-center gap-1">
                                {challenge.mode === 'casual' ? <Coins className="w-4 h-4 text-yellow-500" /> : <Gem className="w-4 h-4 text-purple-500" />}
                                <span className="text-white font-bold">{challenge.stakeTier}</span>
                            </div>
                        </div>
                        <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                            <div className="text-[10px] text-white/40 uppercase font-black mb-1">Modo</div>
                            <div className="flex items-center justify-center gap-1 text-white font-bold uppercase text-xs tracking-wider">
                                <Trophy className={`w-4 h-4 ${challenge.mode === 'ranked' ? 'text-purple-500' : 'text-blue-500'}`} />
                                {challenge.mode}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3">
                        <button
                            onClick={onAccept}
                            className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-yellow-500/20 active:scale-95"
                        >
                            ACEPTAR BATALLA
                        </button>
                        <button
                            onClick={onDecline}
                            className="w-full py-3 bg-white/5 hover:bg-white/10 text-white/60 font-bold uppercase tracking-widest rounded-xl transition-all active:scale-95"
                        >
                            IGNORAR
                        </button>
                    </div>
                </div>

                {/* Progress bar at bottom */}
                <div className="h-1 w-full bg-white/5 overflow-hidden">
                    <div
                        className="h-full bg-yellow-500 transition-all duration-1000 ease-linear"
                        style={{ width: `${(timeLeft / 15) * 100}%` }}
                    />
                </div>
            </div>
        </div>
    );
};
