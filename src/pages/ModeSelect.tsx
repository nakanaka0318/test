import { useNavigate } from 'react-router-dom';
import { useDraftStore } from '../store/draftStore';

export default function ModeSelect() {
  const navigate = useNavigate();
  const startDraft = useDraftStore(s => s.startDraft);

  const choose = (mode: 'pvp' | 'pve') => {
    startDraft(mode);
    navigate('/ban-pick');
  };

  return (
    <div className="screen">
      <button className="back-btn" onClick={() => navigate(-1)}>← 戻る</button>
      <h2 className="page-title">対戦モード選択</h2>
      <div className="home-menu">
        <button className="btn primary" onClick={() => choose('pvp')}>
          🎮 PvP（一人回し）<br /><span className="subtitle">両チームを自分で操作します</span>
        </button>
        <button className="btn" onClick={() => choose('pve')}>
          🤖 PvE（対NPC）<br /><span className="subtitle">Bチームの2キャラをNPCが操作します</span>
        </button>
      </div>
    </div>
  );
}
