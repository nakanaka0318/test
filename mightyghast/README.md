# Mighty Ghast (Forge 1.20.1)

ガストをウィザー級のボスに作り替える Mod です。

| | |
|---|---|
| Minecraft | 1.20.1 |
| Mod Loader | Forge 47.x（`gradle.properties` は 47.2.0） |
| Java | 17 |
| Mod ID | `mightyghast` |

---

## 追加要素

### 1. ガストの超強化

`EntityJoinLevelEvent` で全てのガストを強化します（コンフィグで無効化可）。

| 項目 | バニラ | 強化後 | ウィザー（参考） |
|---|---|---|---|
| 体力 | 10 | **300** | 300 |
| 防具値 | 0 | 12 | 4 |
| 防具強度 | 0 | 8 | 0 |
| ノックバック耐性 | 0 | 0.9 | 1.0 |
| 索敵距離 | 64 | 128 | 40 |
| 飛び道具ダメージ | 等倍 | **35%** | － |
| 爆発ダメージ | 等倍 | **50%** | 無効 |

- **火球の打ち返しでは倒せません。** 矢・火球などの飛び道具は 35% しか通らないので、接近戦か大量の手数が必要です。
- **追尾します。** 専用の移動 AI（`GhastChaseGoal`）でターゲットの上空 7 ブロック・水平距離 14 ブロックを保って張り付きます。
- **反撃します。** 誰かに殴られた瞬間、その相手をターゲットにします。
- **第2形態あり。** 体力が半分（150）を切ると、
  - 技のクールダウンとチャージ時間が **半分**
  - 2 秒ごとに 1 ハート **自動回復**
  - ソウルファイアのパーティクルをまとう
- 技を撃つ前には必ず **チャージ（口が赤く光る＋ガストの唸り声＋炎パーティクル）** が入ります。ここが回避の合図です。

### 2. ガストの技（6種類）

`GhastAbility` に実装されており、**ガストとガストブレードで同じ処理を共有**しています。

| 技 | 内容 | チャージ | ガスト側CD | 剣のCD | 耐久消費 |
|---|---|---|---|---|---|
| 超大火球 (`mega_fireball`) | 爆発力4（通常火球の4倍）の特大火球 | 40t | 80t | 120t | 3 |
| 火球連射 (`fireball_storm`) | 小火球を扇状に12連射 | 30t | 60t | 90t | 2 |
| 隕石雨 (`meteor_rain`) | 狙った地点の上空から火球8発が時間差で落下 | 55t | 160t | 220t | 5 |
| 衝撃波 (`shockwave`) | 半径8の範囲に最大16ダメージ＋吹き飛ばし | 25t | 70t | 70t | 2 |
| 呪詛の咆哮 (`wither_roar`) | 半径12にウィザーII(10秒)＋鈍化II＋弱体化＋8ダメージ | 35t | 120t | 160t | 3 |
| 獄炎の柱 (`flame_pillar`) | 狙った地点に炎の柱。12ダメージ＋10秒間の炎上 | 30t | 100t | 110t | 3 |

技の選択ロジック（ガスト側）:

- 距離 12 未満 … 衝撃波 / 呪詛の咆哮（密着してくる相手を引き剥がす）
- 距離 32 以上 … 超大火球 / 隕石雨
- 中距離 … 超大火球・火球連射・獄炎の柱・衝撃波からランダム
- 真上を取っている時・第2形態では隕石雨の確率が上がる

### 3. ガストインゴット

- 強化ガストを **プレイヤーが倒すと 1〜3 個ドロップ**（ドロップ増加エンチャントで最大 +3）。
- 炎で燃えません（`fireResistant`）。

### 4. ガストブレード

ガストインゴット 2 + 棒 1 でクラフト（通常の剣と同じ配置）。

```
 I
 I
 S
```

| 性能 | 値 |
|---|---|
| 攻撃力 | 11（ネザライトの剣は 8） |
| 攻撃速度 | 1.6 |
| 耐久 | 2400 |
| 採掘レベル | ネザライト相当 |
| エンチャント適性 | 20 |
| 修復素材 | ガストインゴット |

**操作**

- **左クリック**（空振り、またはエンティティへの攻撃時）… 選択中の技を放つ。
  - 近接攻撃のダメージはそのまま入り、技はそれに上乗せされます。
  - 技を撃つと **クールダウン・耐久消費・満腹度消費（1.5）** が発生します。
- **右クリック** … 使用する技を切り替え。`ランダム → 超大火球 → 火球連射 → 隕石雨 → 衝撃波 → 呪詛の咆哮 → 獄炎の柱 → ランダム …` の順に循環し、選択内容は剣の NBT (`SelectedAbility`) に保存されます。

> 空振りの左クリックはクライアントでしか検知できないため、`PlayerInteractEvent.LeftClickEmpty` を拾って
> `SwingBladePacket` でサーバーに通知し、サーバー側で技を発動しています（クールダウン判定もサーバー側）。
> ブロックを殴っている最中（採掘中）には発動しません。

---

## ビルド方法

このリポジトリにはバイナリの `gradlew`（Gradle Wrapper の jar）を含めていません。以下のどちらかで用意してください。

**A. Gradle がインストール済みの場合**

```bash
cd mightyghast
gradle wrapper --gradle-version 8.1.1   # gradlew を生成（初回のみ）
./gradlew build
```

**B. Forge MDK からコピーする場合**

[Forge 1.20.1 の MDK](https://files.minecraftforge.net/net/minecraftforge/forge/index_1.20.1.html) を
ダウンロードし、`gradlew` / `gradlew.bat` / `gradle/wrapper/gradle-wrapper.jar` をこのフォルダにコピーしてから

```bash
./gradlew build
```

完成した jar は `build/libs/mightyghast-1.0.0.jar` に出力されます。これを Forge 1.20.1 の `mods` フォルダに入れてください。

開発中のテスト起動:

```bash
./gradlew runClient    # クライアント
./gradlew runServer    # サーバー
```

> **注意:** ForgeGradle 6 は **Java 17** が必要です（Java 21 では初回デコンパイルに失敗することがあります）。
> `java -version` が 17 でない場合は JDK 17 を指定してください。

---

## コンフィグ

`config/mightyghast-common.toml`（ワールドをまたいで共通）

```toml
[ghast]
  enableGhastBuff = true        # false でバニラのガストに戻る
  maxHealth = 300.0
  armor = 12.0
  armorToughness = 8.0
  knockbackResistance = 0.9
  followRange = 128.0
  projectileDamageTaken = 0.35  # 飛び道具から受けるダメージ倍率
  explosionDamageTaken = 0.5
  enragePhase = true            # 体力半分以下で第2形態

[drops]
  dropGhastIngot = true
  requirePlayerKill = true
  ingotMin = 1
  ingotMax = 3

[abilities]
  damageMultiplier = 1.0        # 全技のダメージ倍率
  swordCooldownMultiplier = 1.0 # 剣のクールダウン倍率（0 でクールダウン無し）
  swordCostsDurability = true
```

「強すぎる / 弱すぎる」と感じたら、まず `maxHealth`・`damageMultiplier`・`projectileDamageTaken` を調整してください。

---

## ソース構成

```
src/main/java/com/nakanaka/mightyghast/
├── MightyGhastMod.java          エントリポイント（@Mod）
├── MightyGhastConfig.java       ForgeConfigSpec
├── ability/
│   ├── GhastAbility.java        6種類の技（ガストと剣で共有）
│   └── AbilityHelper.java       照準・範囲判定・ノックバック等の共通処理
├── entity/
│   ├── GhastAbilityGoal.java    技の撃ち分け AI（チャージ→発動）
│   └── GhastChaseGoal.java      追尾移動 AI
├── event/
│   └── GhastBuffHandler.java    強化・被ダメージ補正・回復・ドロップ
├── item/
│   ├── GhastBladeItem.java      ガストブレード
│   └── ModTiers.java            ガスト素材の Tier
├── network/
│   ├── ModNetwork.java          SimpleChannel
│   └── SwingBladePacket.java    空振り左クリック通知
├── client/
│   └── ClientEvents.java        LeftClickEmpty の検知（クライアント専用）
└── registry/
    ├── ModItems.java
    └── ModCreativeTabs.java
```

## 既知の注意点

- 火球・隕石の**ブロック破壊はゲームルール `mobGriefing` に従います**。クリエイティブの建築を守りたい場合は
  `/gamerule mobGriefing false` を設定してください（技のダメージ自体は残ります）。
- 衝撃波・咆哮などの範囲攻撃は、**自分のペット・同じチーム・クリエイティブのプレイヤー**を巻き込みません。
  プレイヤー同士は PvP 有効時のみ当たります。
- ガストは互いに攻撃しません。
