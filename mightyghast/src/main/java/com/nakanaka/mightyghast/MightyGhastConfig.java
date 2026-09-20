package com.nakanaka.mightyghast;

import net.minecraftforge.common.ForgeConfigSpec;
import org.apache.commons.lang3.tuple.Pair;

/** common コンフィグ（config/mightyghast-common.toml） */
public final class MightyGhastConfig {

    public static final ForgeConfigSpec SPEC;
    public static final MightyGhastConfig CONFIG;

    // --- ガスト強化 ---
    public final ForgeConfigSpec.BooleanValue enableGhastBuff;
    public final ForgeConfigSpec.DoubleValue ghastMaxHealth;
    public final ForgeConfigSpec.DoubleValue ghastArmor;
    public final ForgeConfigSpec.DoubleValue ghastArmorToughness;
    public final ForgeConfigSpec.DoubleValue ghastKnockbackResistance;
    public final ForgeConfigSpec.DoubleValue ghastFollowRange;
    public final ForgeConfigSpec.DoubleValue projectileDamageTaken;
    public final ForgeConfigSpec.DoubleValue explosionDamageTaken;
    public final ForgeConfigSpec.BooleanValue enragePhase;

    // --- ドロップ ---
    public final ForgeConfigSpec.BooleanValue dropIngot;
    public final ForgeConfigSpec.BooleanValue requirePlayerKill;
    public final ForgeConfigSpec.IntValue ingotMin;
    public final ForgeConfigSpec.IntValue ingotMax;

    // --- 技 ---
    public final ForgeConfigSpec.DoubleValue abilityDamageMultiplier;
    public final ForgeConfigSpec.DoubleValue swordCooldownMultiplier;
    public final ForgeConfigSpec.BooleanValue swordCostsDurability;

    private MightyGhastConfig(ForgeConfigSpec.Builder builder) {
        builder.comment("ガストの強化設定").push("ghast");
        enableGhastBuff = builder
                .comment("false にするとガストはバニラのままになります")
                .define("enableGhastBuff", true);
        ghastMaxHealth = builder
                .comment("強化ガストの最大体力（バニラは 10 / ウィザーは 300）")
                .defineInRange("maxHealth", 300.0D, 1.0D, 1024.0D);
        ghastArmor = builder.defineInRange("armor", 12.0D, 0.0D, 30.0D);
        ghastArmorToughness = builder.defineInRange("armorToughness", 8.0D, 0.0D, 20.0D);
        ghastKnockbackResistance = builder.defineInRange("knockbackResistance", 0.9D, 0.0D, 1.0D);
        ghastFollowRange = builder
                .comment("プレイヤーを索敵する距離（ブロック）")
                .defineInRange("followRange", 128.0D, 16.0D, 256.0D);
        projectileDamageTaken = builder
                .comment("矢・跳ね返した火球など飛び道具から受けるダメージ倍率")
                .defineInRange("projectileDamageTaken", 0.35D, 0.0D, 1.0D);
        explosionDamageTaken = builder
                .comment("爆発から受けるダメージ倍率")
                .defineInRange("explosionDamageTaken", 0.5D, 0.0D, 1.0D);
        enragePhase = builder
                .comment("体力が半分以下で第2形態（技の連射＋自動回復）になる")
                .define("enragePhase", true);
        builder.pop();

        builder.comment("ドロップ設定").push("drops");
        dropIngot = builder.define("dropGhastIngot", true);
        requirePlayerKill = builder
                .comment("プレイヤーが倒した時のみドロップする")
                .define("requirePlayerKill", true);
        ingotMin = builder.defineInRange("ingotMin", 1, 0, 64);
        ingotMax = builder.defineInRange("ingotMax", 3, 0, 64);
        builder.pop();

        builder.comment("技（アビリティ）設定").push("abilities");
        abilityDamageMultiplier = builder
                .comment("全ての技のダメージ倍率")
                .defineInRange("damageMultiplier", 1.0D, 0.0D, 10.0D);
        swordCooldownMultiplier = builder
                .comment("ガストブレードで技を撃った後のクールダウン倍率")
                .defineInRange("swordCooldownMultiplier", 1.0D, 0.0D, 10.0D);
        swordCostsDurability = builder
                .comment("技の使用で耐久値を消費する")
                .define("swordCostsDurability", true);
        builder.pop();
    }

    static {
        Pair<MightyGhastConfig, ForgeConfigSpec> pair = new ForgeConfigSpec.Builder().configure(MightyGhastConfig::new);
        CONFIG = pair.getLeft();
        SPEC = pair.getRight();
    }

    public static MightyGhastConfig get() {
        return CONFIG;
    }
}
