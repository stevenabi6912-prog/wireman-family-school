import { GAME_TYPES } from '../../lib/games/types';
import { GameIcon } from './Boards';
import './GameBoards.css';

const MEDALS = ['🥇', '🥈', '🥉'];

// `ladder` comes from buildLadder(). Purely presentational: who is who is
// passed in, so the same board renders live data and GameLab's mock season.
export function LadderBoard({ ladder, me, nameOf, avatarOf, partial = false }) {
  const { monthLabel, standings, champion } = ladder;
  const anyWins = standings.some((r) => r.monthTotal > 0);
  const champs = champion?.ids ?? [];
  return (
    <section className="ladder">
      <header className="ladder-head">
        <span className="ladder-trophy" aria-hidden="true">🏆</span>
        <div>
          <h4 className="ladder-title">Season ladder</h4>
          <p className="ladder-sub">{monthLabel} — most wins takes the crown</p>
        </div>
      </header>

      {champion && (
        <p className="ladder-champ">
          <span className="ladder-champ-label">Family champion — {champion.month}</span>
          <span className="ladder-champ-name">
            {champs.map((id) => `${avatarOf(id)} ${nameOf(id)}`).join(' & ')} 👑
          </span>
        </p>
      )}

      <div className="ladder-table" role="table">
        <div className="ladder-row ladder-cols" role="row">
          <span className="ladder-rank" />
          <span className="ladder-who" />
          {Object.entries(GAME_TYPES).map(([k, t]) => (
            <span key={k} className="ladder-num" title={t.label}><GameIcon type={k} /></span>
          ))}
          <span className="ladder-num ladder-total">Month</span>
          <span className="ladder-num ladder-all">All time</span>
        </div>
        {standings.map((r, i) => (
          <div key={r.id} className={`ladder-row ${r.id === me ? 'ladder-me' : ''} ${anyWins && i === 0 ? 'ladder-lead' : ''}`} role="row">
            <span className="ladder-rank">{anyWins && r.monthTotal > 0 && i < 3 ? MEDALS[i] : i + 1}</span>
            <span className="ladder-who">
              <span className="ladder-avatar">{avatarOf(r.id)}</span>
              <span className="ladder-name">{nameOf(r.id)}{champs.includes(r.id) ? ' 👑' : ''}</span>
            </span>
            {Object.keys(GAME_TYPES).map((k) => (
              <span key={k} className={`ladder-num ${r.month[k] ? '' : 'ladder-zero'}`}>{r.month[k]}</span>
            ))}
            <span className="ladder-num ladder-total">{r.monthTotal}</span>
            <span className="ladder-num ladder-all">{r.allTime}</span>
          </div>
        ))}
      </div>

      {!anyWins && <p className="ladder-note">No wins yet this month — first one on the board leads the ladder!</p>}
      {partial && <p className="ladder-note">Showing only the games you played in.</p>}
    </section>
  );
}
