import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';

export default function PatchNotes() {
  const navigate = useNavigate();
  const patchNotes = useGameStore(s => s.patchNotes);
  const sorted = [...patchNotes].sort((a, b) => b.version - a.version);

  return (
    <div className="screen">
      <button className="back-btn" onClick={() => navigate(-1)}>← 戻る</button>
      <h2 className="page-title">パッチノート</h2>
      {sorted.length === 0 && <p className="subtitle">まだパッチノートはありません。バトルを終えると発行されます。</p>}
      <div className="list">
        {sorted.map(note => (
          <div key={note.id} className="patch-card" onClick={() => navigate(`/patch-notes/${note.id}`)}>
            <div>
              <div className="ver">v{note.version}</div>
              <div className="date">{new Date(note.createdAt).toLocaleString('ja-JP')}</div>
            </div>
            <div className="subtitle">{note.lines.length}件の変更 ›</div>
          </div>
        ))}
      </div>
    </div>
  );
}
