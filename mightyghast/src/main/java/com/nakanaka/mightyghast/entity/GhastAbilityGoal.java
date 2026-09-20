package com.nakanaka.mightyghast.entity;

import com.nakanaka.mightyghast.MightyGhastConfig;
import com.nakanaka.mightyghast.ability.AbilityHelper;
import com.nakanaka.mightyghast.ability.GhastAbility;
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.util.Mth;
import net.minecraft.util.RandomSource;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.ai.goal.Goal;
import net.minecraft.world.entity.monster.Ghast;

import java.util.EnumSet;

/**
 * 強化ガストの攻撃 AI。距離と体力に応じて {@link GhastAbility} を撃ち分ける。
 * 技の前には「溜め（チャージ）」が入り、口が赤く光るので回避の合図になる。
 */
public class GhastAbilityGoal extends Goal {

    private static final double MAX_RANGE = 64.0D;

    private final Ghast ghast;
    private int cooldown;
    private int chargeTime = -1;
    private GhastAbility pending;

    public GhastAbilityGoal(Ghast ghast) {
        this.ghast = ghast;
        this.setFlags(EnumSet.of(Goal.Flag.LOOK));
    }

    @Override
    public boolean canUse() {
        LivingEntity target = this.ghast.getTarget();
        return target != null && target.isAlive() && this.ghast.distanceToSqr(target) < MAX_RANGE * MAX_RANGE;
    }

    @Override
    public boolean canContinueToUse() {
        return this.canUse();
    }

    @Override
    public boolean requiresUpdateEveryTick() {
        return true;
    }

    @Override
    public void start() {
        this.cooldown = 20;
        this.chargeTime = -1;
        this.pending = null;
    }

    @Override
    public void stop() {
        this.ghast.setCharging(false);
        this.chargeTime = -1;
        this.pending = null;
    }

    @Override
    public void tick() {
        LivingEntity target = this.ghast.getTarget();
        if (target == null || !(this.ghast.level() instanceof ServerLevel level)) {
            return;
        }

        this.faceTarget(target);

        boolean enraged = this.isEnraged();

        if (this.chargeTime >= 0 && this.pending != null) {
            this.chargeTime++;
            int needed = enraged ? Math.max(8, this.pending.getChargeTicks() / 2) : this.pending.getChargeTicks();

            // 溜めの演出
            if (this.chargeTime % 4 == 0) {
                AbilityHelper.particles(level, enraged ? ParticleTypes.SOUL_FIRE_FLAME : ParticleTypes.FLAME,
                        this.ghast.position().add(0.0D, this.ghast.getBbHeight() * 0.5D, 0.0D), 12, 1.5D, 0.02D);
            }

            if (this.chargeTime >= needed) {
                this.ghast.setCharging(false);
                this.pending.cast(level, this.ghast, target);
                int base = this.pending.getMobCooldown();
                this.cooldown = enraged ? base / 2 : base;
                this.cooldown += this.ghast.getRandom().nextInt(20);
                this.chargeTime = -1;
                this.pending = null;
            }
            return;
        }

        if (--this.cooldown > 0) {
            return;
        }

        if (!this.ghast.getSensing().hasLineOfSight(target)) {
            this.cooldown = 10;
            return;
        }

        this.pending = this.pickAbility(target, enraged);
        this.chargeTime = 0;
        this.ghast.setCharging(true);
        AbilityHelper.playSound(level, this.ghast.position(), SoundEvents.GHAST_WARN, 6.0F, enraged ? 0.6F : 1.0F);
    }

    private boolean isEnraged() {
        return MightyGhastConfig.get().enragePhase.get()
                && this.ghast.getHealth() < this.ghast.getMaxHealth() * 0.5F;
    }

    private void faceTarget(LivingEntity target) {
        double dx = target.getX() - this.ghast.getX();
        double dz = target.getZ() - this.ghast.getZ();
        this.ghast.setYRot(-((float) Mth.atan2(dx, dz)) * (180F / (float) Math.PI));
        this.ghast.yBodyRot = this.ghast.getYRot();
        this.ghast.getLookControl().setLookAt(target, 30.0F, 30.0F);
    }

    /** 距離と形態に応じて技を選ぶ。 */
    private GhastAbility pickAbility(LivingEntity target, boolean enraged) {
        RandomSource random = this.ghast.getRandom();
        double distance = this.ghast.distanceTo(target);
        boolean above = this.ghast.getY() - target.getY() > 6.0D;

        if (distance < 12.0D) {
            // 密着されたら吹き飛ばすか呪う
            return random.nextBoolean() ? GhastAbility.SHOCKWAVE : GhastAbility.WITHER_ROAR;
        }

        if (enraged && random.nextInt(3) == 0) {
            return GhastAbility.METEOR_RAIN;
        }

        if (above && random.nextInt(3) == 0) {
            return GhastAbility.METEOR_RAIN;
        }

        if (distance > 32.0D) {
            return random.nextBoolean() ? GhastAbility.MEGA_FIREBALL : GhastAbility.METEOR_RAIN;
        }

        GhastAbility[] mid = {
                GhastAbility.MEGA_FIREBALL,
                GhastAbility.FIREBALL_STORM,
                GhastAbility.FLAME_PILLAR,
                GhastAbility.SHOCKWAVE
        };

        return mid[random.nextInt(mid.length)];
    }
}
