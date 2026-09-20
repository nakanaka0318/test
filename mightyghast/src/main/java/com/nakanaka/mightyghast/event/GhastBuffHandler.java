package com.nakanaka.mightyghast.event;

import com.nakanaka.mightyghast.MightyGhastConfig;
import com.nakanaka.mightyghast.MightyGhastMod;
import com.nakanaka.mightyghast.entity.GhastAbilityGoal;
import com.nakanaka.mightyghast.entity.GhastChaseGoal;
import com.nakanaka.mightyghast.registry.ModItems;
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.tags.DamageTypeTags;
import net.minecraft.util.RandomSource;
import net.minecraft.world.damagesource.DamageSource;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.ai.attributes.Attribute;
import net.minecraft.world.entity.ai.attributes.AttributeInstance;
import net.minecraft.world.entity.ai.attributes.Attributes;
import net.minecraft.world.entity.ai.goal.target.NearestAttackableTargetGoal;
import net.minecraft.world.entity.item.ItemEntity;
import net.minecraft.world.entity.monster.Ghast;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;
import net.minecraftforge.event.entity.EntityJoinLevelEvent;
import net.minecraftforge.event.entity.living.LivingDropsEvent;
import net.minecraftforge.event.entity.living.LivingEvent;
import net.minecraftforge.event.entity.living.LivingHurtEvent;
import net.minecraftforge.eventbus.api.SubscribeEvent;
import net.minecraftforge.fml.common.Mod;

import java.util.Locale;

/** ガストの強化・ドロップ処理をまとめたハンドラ。 */
@Mod.EventBusSubscriber(modid = MightyGhastMod.MOD_ID, bus = Mod.EventBusSubscriber.Bus.FORGE)
public final class GhastBuffHandler {

    private static final String BUFF_TAG = "MightyGhastBuffed";

    private GhastBuffHandler() {
    }

    // ------------------------------------------------------------------
    // 1. ガストの超強化
    // ------------------------------------------------------------------
    @SubscribeEvent
    public static void onEntityJoinLevel(EntityJoinLevelEvent event) {
        if (event.getLevel().isClientSide()) {
            return;
        }
        if (!(event.getEntity() instanceof Ghast ghast)) {
            return;
        }
        if (!MightyGhastConfig.get().enableGhastBuff.get()) {
            return;
        }

        applyAttributes(ghast);
        injectGoals(ghast);
    }

    private static void applyAttributes(Ghast ghast) {
        MightyGhastConfig config = MightyGhastConfig.get();

        setBaseValue(ghast, Attributes.MAX_HEALTH, config.ghastMaxHealth.get());
        setBaseValue(ghast, Attributes.ARMOR, config.ghastArmor.get());
        setBaseValue(ghast, Attributes.ARMOR_TOUGHNESS, config.ghastArmorToughness.get());
        setBaseValue(ghast, Attributes.KNOCKBACK_RESISTANCE, config.ghastKnockbackResistance.get());
        setBaseValue(ghast, Attributes.FOLLOW_RANGE, config.ghastFollowRange.get());

        // 初回のみ全回復（リロードのたびに回復させない）
        if (!ghast.getPersistentData().getBoolean(BUFF_TAG)) {
            ghast.getPersistentData().putBoolean(BUFF_TAG, true);
            ghast.setHealth(ghast.getMaxHealth());
        }
    }

    private static void setBaseValue(LivingEntity entity, Attribute attribute, double value) {
        AttributeInstance instance = entity.getAttribute(attribute);
        if (instance != null) {
            instance.setBaseValue(value);
        }
    }

    private static void injectGoals(Ghast ghast) {
        boolean alreadyInjected = ghast.goalSelector.getAvailableGoals().stream()
                .anyMatch(wrapped -> wrapped.getGoal() instanceof GhastAbilityGoal);
        if (alreadyInjected) {
            return;
        }

        // バニラの単発火球ゴールは新しい技システムに置き換える
        ghast.goalSelector.removeAllGoals(goal ->
                goal.getClass().getSimpleName().toLowerCase(Locale.ROOT).contains("fireball"));

        ghast.goalSelector.addGoal(3, new GhastAbilityGoal(ghast));
        ghast.goalSelector.addGoal(4, new GhastChaseGoal(ghast));

        // 索敵範囲をフォロー距離いっぱいまで広げる
        ghast.targetSelector.addGoal(2,
                new NearestAttackableTargetGoal<>(ghast, Player.class, 10, true, false, entity -> true));
    }

    // ------------------------------------------------------------------
    // 2. 被ダメージ補正と反撃
    // ------------------------------------------------------------------
    @SubscribeEvent
    public static void onGhastHurt(LivingHurtEvent event) {
        if (!(event.getEntity() instanceof Ghast ghast)) {
            return;
        }
        MightyGhastConfig config = MightyGhastConfig.get();
        if (!config.enableGhastBuff.get()) {
            return;
        }

        DamageSource source = event.getSource();
        if (source.is(DamageTypeTags.IS_PROJECTILE)) {
            event.setAmount((float) (event.getAmount() * config.projectileDamageTaken.get()));
        } else if (source.is(DamageTypeTags.IS_EXPLOSION)) {
            event.setAmount((float) (event.getAmount() * config.explosionDamageTaken.get()));
        }

        if (source.getEntity() instanceof LivingEntity attacker && !(attacker instanceof Ghast)) {
            ghast.setTarget(attacker);
        }
    }

    // ------------------------------------------------------------------
    // 3. 第2形態（体力半分以下）の自動回復
    // ------------------------------------------------------------------
    @SubscribeEvent
    public static void onGhastTick(LivingEvent.LivingTickEvent event) {
        if (!(event.getEntity() instanceof Ghast ghast)) {
            return;
        }
        if (!(ghast.level() instanceof ServerLevel level)) {
            return;
        }
        MightyGhastConfig config = MightyGhastConfig.get();
        if (!config.enableGhastBuff.get() || !config.enragePhase.get()) {
            return;
        }
        if (ghast.getHealth() >= ghast.getMaxHealth() * 0.5F) {
            return;
        }

        if (ghast.tickCount % 40 == 0) {
            ghast.heal(2.0F);
        }
        if (ghast.tickCount % 10 == 0) {
            level.sendParticles(ParticleTypes.SOUL_FIRE_FLAME,
                    ghast.getX(), ghast.getY() + ghast.getBbHeight() * 0.5D, ghast.getZ(),
                    6, 1.8D, 1.8D, 1.8D, 0.01D);
        }
    }

    // ------------------------------------------------------------------
    // 4. ガストインゴットのドロップ
    // ------------------------------------------------------------------
    @SubscribeEvent
    public static void onGhastDrops(LivingDropsEvent event) {
        if (!(event.getEntity() instanceof Ghast ghast)) {
            return;
        }
        MightyGhastConfig config = MightyGhastConfig.get();
        if (!config.dropIngot.get()) {
            return;
        }
        if (config.requirePlayerKill.get() && !event.isRecentlyHit()) {
            return;
        }

        RandomSource random = ghast.getRandom();
        int min = config.ingotMin.get();
        int max = Math.max(min, config.ingotMax.get());
        int count = min + random.nextInt(max - min + 1);

        int looting = event.getLootingLevel();
        if (looting > 0) {
            count += random.nextInt(looting + 1);
        }

        if (count <= 0) {
            return;
        }

        ItemEntity drop = new ItemEntity(ghast.level(), ghast.getX(), ghast.getY(), ghast.getZ(),
                new ItemStack(ModItems.GHAST_INGOT.get(), count));
        drop.setDefaultPickUpDelay();
        event.getDrops().add(drop);
    }
}
