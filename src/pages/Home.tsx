import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';

export default function Home() {
  const navigate = useNavigate();
  const resetAll = useGameStore(s => s.resetAll);
  const patchCount = useGameStore(s => s.patchNotes.length);

  const handleReset = () => {
    if (confirm('パッチノートを白紙に戻し、全キャラを初期ステータスに戻します。よろしいですか？')) {
      resetAll();
    }
  };

  return (
    <div className="screen">
      <div className="home-hero">
        <h1>自動パッチノート<br />メタ回転バトル</h1>
        <p>戦って、変化する。終わらないメタの物語。</p>
        <p className="subtitle">現在のパッチ: v{patchCount}</p>
      </div>
      <div className="home-menu">
        <button className="btn primary" onClick={() => navigate('/mode-select')}>⚔️ バトルへ</button>
        <button className="btn" onClick={() => navigate('/patch-notes')}>📜 パッチノートを確認</button>
        <button className="btn" onClick={() => navigate('/status')}>📊 キャラ現在ステータス確認</button>
        <button className="btn danger" onClick={handleReset}>🔄 初期化</button>
      </div>
    </div>
  );
}
