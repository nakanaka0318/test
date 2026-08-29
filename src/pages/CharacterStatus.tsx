import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore, getCharacterList } from '../store/gameStore';
import { renderTemplate } from '../utils/renderTemplate';
import { withBaseAsCurrent, isModified } from '../utils/statusView';

export default function CharacterStatus() {
  const navigate = useNavigate();
  const tunableState = useGameStore(s => s.tunableState);
  const characters = getCharacterList(tunableState);
  const [showInitial, setShowInitial] = useState<Record<string, boolean>>({});

  return (
    <div className="screen">
      <button className="back-btn" onClick={() => navigate(-1)}>← 戻る</button>
      <h2 className="page-title">キャラ現在ステータス</h2>
      <p className="subtitle">
        <span className="tunable">オレンジ色の数値</span> はナーフ・アッパーの対象になりうるステータスです。ℹ️で初期値と比較できます。
      </p>
      {characters.map(def => {
        const initial = !!showInitial[def.id];
        const displayDef = initial ? withBaseAsCurrent(def) : def;
        const hpId = `${def.id}.hp`;
        const moveId = `${def.id}.move`;
        const atkId = `${def.id}.atk`;
        return (
          <div key={def.id} className="status-card">
            <h3>
              {def.name}
              <button className="info-btn" onClick={() => setShowInitial(s => ({ ...s, [def.id]: !s[def.id] }))}>
                ℹ️
              </button>
              {initial && <span className="subtitle">初期ステータス表示中</span>}
              {!initial && isModified(def) && <span className="subtitle">（変更あり）</span>}
            </h3>
            <p>
              HP <span className="tunable">{displayDef.tunables[hpId].current}</span>
              {'　'}移動ポイント <span className="tunable">{displayDef.tunables[moveId].current}</span>
              {'　'}基礎攻撃力 <span className="tunable">{displayDef.tunables[atkId].current}</span>
            </p>
            <div className="skill-block">
              <span className="skill-name">パッシブ：{def.passiveName}</span>
              <p>{renderTemplate(displayDef, def.passiveDescriptionTemplate)}</p>
            </div>
            {def.skills.map(sk => (
              <div className="skill-block" key={sk.id}>
                <span className="skill-name">{sk.name}</span>
                <p>{renderTemplate(displayDef, sk.descriptionTemplate)}</p>
                <p className="subtitle">発動方法：{sk.activationHint}</p>
              </div>
            ))}
            <div className="skill-block">
              <span className="skill-name">クイックスキル：{def.quickSkill.name}</span>
              <p>{renderTemplate(displayDef, def.quickSkill.descriptionTemplate)}</p>
              <p className="subtitle">発動方法：{def.quickSkill.activationHint}</p>
            </div>
            {initial && <p className="initial-note">※ これは初期（未変更）ステータスです。実際の現在値とは異なる場合があります。</p>}
          </div>
        );
      })}
    </div>
  );
}
