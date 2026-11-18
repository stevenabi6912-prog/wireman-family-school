// The presentational half of the game lobby: who's who, game rows, the
// new-game tiles and the break-room picker. No Firestore in here.

import { GAME_TYPES } from '../../lib/games/types';
import { resolveTheme } from '../../config/themes';
import { PEOPLE, displayName, isParentId } from '../../config/students';
import { GameIcon } from './Boards';

// Mom and Dad are opponents too, so the roster is the whole family — anyone
// with a login can be challenged, and the games work the same either way.
export const ROSTER = Object.keys(PEOPLE);
export const NAMES = Object.fromEntries(ROSTER.map((id) => [id, displayName(id)]));
export const avatarOf = (id) => (isParentId(id) ? PEOPLE[id].emoji : resolveTheme(id).avatar);

export function GameRow({ game, me, onOpen, awaiting }) {
  const them = game.players.find((p) => p !== me) ?? '?';
  const t = GAME_TYPES[game.type] ?? { emoji: '🎲', label: game.type };
  const settingUp = game.type === 'battleship' && game.status === 'setup';
  return (
    <button className={`vs-row ${awaiting ? 'vs-row-turn' : ''}`} onClick={onOpen}>
      <GameIcon type={game.type} />
      <span className="vs-row-title">
        <span className="vs-row-game">{t.label}</span>
        <span className="vs-row-them">vs {avatarOf(them)} {NAMES[them] ?? them}</span>
      </span>
      <span className={`vs-row-meta ${game.status === 'over' && game.winner === me ? 'vs-row-won' : ''}`}>
        {game.status === 'over'
          ? (game.winner === me ? '🏆 You won!' : game.winner ? 'They won' : 'Draw')
          : settingUp
            ? (awaiting ? 'Place your fleet' : "Waiting on their fleet")
            : awaiting ? 'Your move' : 'Waiting'}
      </span>
    </button>
  );
}

export function NewGameTiles({ onPick }) {
  return (
    <div className="vs-newgrid">
      {Object.entries(GAME_TYPES).map(([key, t]) => (
        <button key={key} className={`vs-newbtn vs-new-${key}`} onClick={() => onPick(key)}>
          <GameIcon type={key} />
          <span>{t.label}</span>
        </button>
      ))}
    </div>
  );
}

const SOLO_GAMES = [
  ['sudoku', '🔢', 'Sudoku'],
  ['wordsearch', '🔍', 'Word Search'],
  ['builder', '🔤', 'Word Builder'],
  ['trivia', '🏰', 'Castle Trivia'],
  ['typing', '⌨️', 'Typing Sprint'],
];

export function BreakPicker({ onPick, myTurnCount = 0 }) {
  return (
    <div className="break-picker">
      {SOLO_GAMES.map(([key, icon, label]) => (
        <button key={key} className={`break-pick break-pick-${key}`} onClick={() => onPick(key)}>
          <span className="break-pick-icon" aria-hidden="true">{icon}</span>
          <span>{label}</span>
        </button>
      ))}
      <button className="break-pick break-versus" onClick={() => onPick('versus')}>
        <span className="break-pick-icon" aria-hidden="true">⚔️</span>
        <span>Play someone{myTurnCount > 0 && <span className="break-turnbadge">{myTurnCount}</span>}</span>
      </button>
    </div>
  );
}
