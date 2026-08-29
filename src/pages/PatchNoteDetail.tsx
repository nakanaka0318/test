import { useNavigate, useParams } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { tierDirLabel } from '../engine/nerfBuff';

export default function PatchNoteDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const note = useGameStore(s => s.patchNotes.find(n => n.id === id));

  if (!note) {
    return (
      <div className="screen">
        <button className="back-btn" onClick={() => navigate('/patch-notes')}>← 戻る</button>
        <p>パッチノートが見つかりませんでした。</p>
      </div>
    );
  }

  return (
    <div className="screen">
      <button className="back-btn" onClick={() => navigate('/patch-notes')}>← 戻る</button>
      <h2 className="page-title">パッチノート v{note.version}</h2>
      <p className="subtitle">{new Date(note.createdAt).toLocaleString('ja-JP')}</p>
      <div className="panel">
        <p className="subtitle">{note.resultSummary}</p>
      </div>
      <div className="panel">
        {note.lines.map((line, i) => (
          <div key={i} className="patch-line">
            <span className={`tag ${line.dir}`}>{tierDirLabel(line.tier, line.dir)}</span>
            <span className="char-name">{line.characterName}</span>
            <ul>
              {line.changes.map((c, j) => <li key={j}>{c}</li>)}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
