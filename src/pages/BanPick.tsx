import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDraftStore } from '../store/draftStore';
import { useBattleStore } from '../store/battleStore';
import { useGameStore } from '../store/gameStore';
import { CHARACTER_MAP } from '../data/characters';

export default function BanPick() {
  const navigate = useNavigate();
  const draft = useDraftStore();
  const startBattle = useBattleStore(s => s.start);
  const getCurrentCharacter = useGameStore(s => s.getCurrentCharacter);

  useEffect(() => {
    if (!draft.mode) { navigate('/mode-select'); }
  }, [draft.mode, navigate]);

  useEffect(() => {
    if (draft.finished || !draft.isNpcTurn()) return;
    const timer = setTimeout(() => draft.autoResolveIfNpc(), 500);
    return () => clearTimeout(timer);
  }, [draft.stepIndex, draft.finished, draft]);

  useEffect(() => {
    if (!draft.finished) return;
    const teamA = draft.picksA.map(id => getCurrentCharacter(id));
    const teamB = draft.picksB.map(id => getCurrentCharacter(id));
    const poison = getCurrentCharacter('poison');
    startBattle({
      mode: draft.mode!,
      teamA,
      teamB,
      npcTeam: draft.npcTeam,
      globalGreenTilePoisonAmount: poison.tunables['poison.greenTilePoison'].current,
    });
    navigate('/battle');
  }, [draft.finished]); // eslint-disable-line react-hooks/exhaustive-deps

  const step = draft.currentStep();
  const npcTurn = draft.isNpcTurn();

  return (
    <div className="screen">
      <h2 className="page-title">バン & ピック</h2>
      {step && (
        <div className="hint-bar">
          {draft.sideTeam(step.side) === 'A' ? 'Aチーム' : 'Bチーム'}
          {step.kind === 'ban' ? ' が BAN するキャラを選択' : ' が PICK するキャラを選択'}
          {npcTurn && '（NPC思考中…）'}
        </div>
      )}
      <div className="panel" style={{ display: 'flex', gap: 12, fontSize: 12 }}>
        <div>Aチーム: {draft.picksA.map(id => CHARACTER_MAP[id].name).join('、') || '未定'}</div>
        <div>Bチーム: {draft.picksB.map(id => CHARACTER_MAP[id].name).join('、') || '未定'}</div>
      </div>
      <div className="char-grid">
        {Object.values(CHARACTER_MAP).map(c => {
          const banned = draft.bans.includes(c.id);
          const picked = draft.picksA.includes(c.id) || draft.picksB.includes(c.id);
          const disabled = banned || picked || npcTurn || !step;
          return (
            <button
              key={c.id}
              className={`char-chip${banned ? ' banned' : ''}${disabled && !banned ? ' disabled' : ''}`}
              disabled={disabled}
              onClick={() => draft.choose(c.id)}
            >
              {c.name}
            </button>
          );
        })}
      </div>
      <div className="log-panel">
        {[...draft.log].reverse().map((l, i) => <div className="entry" key={i}>{l}</div>)}
      </div>
    </div>
  );
}
