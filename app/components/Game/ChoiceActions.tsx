import React from 'react';
import { Choice } from '@/lib/types';
import { CHOICE_EMOJIS } from '@/lib/constants';

interface ChoiceActionsProps {
    disabled: boolean;
    onMakeChoice: (choice: Choice) => void;
    playSound: (path: string) => void;
}

export const ChoiceActions: React.FC<ChoiceActionsProps> = ({ disabled, onMakeChoice, playSound }) => {

    const handleChoice = (c: Choice) => {
        if (disabled) return;
        onMakeChoice(c);
    };

    return (
        <div className="choice-panel slide-up">
            <p className="choice-instruction">
                {disabled ? 'WAITING...' : 'CHOOSE YOUR WEAPON'}
            </p>
            <div className="choices-row">
                {/* Rock */}
                <button
                    className={`choice-card ${disabled ? 'disabled' : ''}`}
                    onClick={() => handleChoice('rock')}
                    disabled={disabled}
                    style={{ '--choice-color': '#ff4757' } as any}
                >
                    <div className="choice-emoji">{CHOICE_EMOJIS.rock}</div>
                    <div className="choice-name">ROCK</div>
                </button>

                {/* Paper */}
                <button
                    className={`choice-card ${disabled ? 'disabled' : ''}`}
                    onClick={() => handleChoice('paper')}
                    disabled={disabled}
                    style={{ '--choice-color': '#2ed573' } as any}
                >
                    <div className="choice-emoji">{CHOICE_EMOJIS.paper}</div>
                    <div className="choice-name">PAPER</div>
                </button>

                {/* Scissors */}
                <button
                    className={`choice-card ${disabled ? 'disabled' : ''}`}
                    onClick={() => handleChoice('scissors')}
                    disabled={disabled}
                    style={{ '--choice-color': '#1e90ff' } as any}
                >
                    <div className="choice-emoji">{CHOICE_EMOJIS.scissors}</div>
                    <div className="choice-name">SCISSORS</div>
                </button>
            </div>
        </div>
    );
};
