package com.nakanaka.mightyghast.ability;

import com.nakanaka.mightyghast.MightyGhastMod;
import net.minecraft.ChatFormatting;
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.util.Mth;
import net.minecraft.util.RandomSource;
import net.minecraft.world.damagesource.DamageSource;
import net.minecraft.world.effect.MobEffectInstance;
import net.minecraft.world.effect.MobEffects;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.projectile.LargeFireball;
import net.minecraft.world.entity.projectile.SmallFireball;
import net.minecraft.world.phys.Vec3;

import javax.annotation.Nullable;
import java.util.List;
import java.util.Locale;

/**
 * 強化ガストが使う技。ガストブレードからも同じ実装を呼び出す。
 *
 * <p>チャージ時間 = ガストが溜めるティック数、mobCooldown = ガストの次の技までの間隔、
 * playerCooldown = ガストブレードのクールダウン、durabilityCost = 剣の耐久消費。</p>
 */
public enum GhastAbility {

    /** 超大火球：通常の4倍の爆発力を持つ特大火球 */
    MEGA_FIREBALL("mega_fireball", 40, 80, 120, 3) {
        @Override
        public void cast(ServerLevel level, LivingEntity caster, @Nullable LivingEntity target) {
            Vec3 dir = AbilityHelper.aimDirection(caster, target);
            Vec3 pos = AbilityHelper.muzzle(caster, dir);

            LargeFireball fireball = new LargeFireball(level, caster, dir.x, dir.y, dir.z, 4);
            fireball.setPos(pos.x, pos.y, pos.z);
            level.addFreshEntity(fireball);

            AbilityHelper.playSound(level, pos, SoundEvents.GHAST_SHOOT, 6.0F, 0.5F);
            AbilityHelper.particles(level, ParticleTypes.LARGE_SMOKE, pos, 30, 0.4D, 0.05D);
        }
    },

    /** 火球連射：小火球を扇状に12連射 */
    FIREBALL_STORM("fireball_storm", 30, 60, 90, 2) {
        @Override
        public void cast(ServerLevel level, LivingEntity caster, @Nullable LivingEntity target) {
            Vec3 dir = AbilityHelper.aimDirection(caster, target);
            Vec3 pos = AbilityHelper.muzzle(caster, dir);
            RandomSource random = caster.getRandom();

            for (int i = 0; i < 12; i++) {
                Vec3 spread = dir.add(
                        (random.nextDouble() - 0.5D) * 0.35D,
                        (random.nextDouble() - 0.5D) * 0.25D,
                        (random.nextDouble() - 0.5D) * 0.35D).normalize();

                SmallFireball small = new SmallFireball(level, caster, spread.x, spread.y, spread.z);
                small.setPos(pos.x, pos.y, pos.z);
                level.addFreshEntity(small);
            }

            AbilityHelper.playSound(level, pos, SoundEvents.BLAZE_SHOOT, 4.0F, 0.7F);
            AbilityHelper.particles(level, ParticleTypes.FLAME, pos, 40, 0.5D, 0.1D);
        }
    },

    /** 隕石雨：狙った地点の上空から特大火球が降り注ぐ */
    METEOR_RAIN("meteor_rain", 55, 160, 220, 5) {
        @Override
        public void cast(ServerLevel level, LivingEntity caster, @Nullable LivingEntity target) {
            Vec3 center = AbilityHelper.aimPoint(caster, target, 48.0D);
            RandomSource random = caster.getRandom();

            for (int i = 0; i < 8; i++) {
                double offsetX = (random.nextDouble() - 0.5D) * 12.0D;
                double offsetZ = (random.nextDouble() - 0.5D) * 12.0D;
                // 高さをずらして時間差で落下させる
                double y = center.y + 14.0D + i * 3.5D + random.nextDouble() * 2.0D;

                Vec3 dir = new Vec3((random.nextDouble() - 0.5D) * 0.15D, -1.0D,
                        (random.nextDouble() - 0.5D) * 0.15D).normalize();

                LargeFireball meteor = new LargeFireball(level, caster, dir.x, dir.y, dir.z, 2);
                meteor.setPos(center.x + offsetX, y, center.z + offsetZ);
                level.addFreshEntity(meteor);
            }

            AbilityHelper.playSound(level, center, SoundEvents.GHAST_SCREAM, 8.0F, 0.6F);
            AbilityHelper.playSound(level, center, SoundEvents.WITHER_SHOOT, 6.0F, 0.5F);
        }
    },

    /** 衝撃波：着弾点を中心に大ダメージ＋吹き飛ばし */
    SHOCKWAVE("shockwave", 25, 70, 70, 2) {
        @Override
        public void cast(ServerLevel level, LivingEntity caster, @Nullable LivingEntity target) {
            Vec3 center = AbilityHelper.aimPoint(caster, target, 28.0D);
            double radius = 8.0D;
            DamageSource source = AbilityHelper.source(level, caster);
            List<LivingEntity> victims = AbilityHelper.targetsAround(level, caster, center, radius);

            for (LivingEntity victim : victims) {
                double distance = victim.position().distanceTo(center);
                float falloff = (float) Mth.clamp(1.0D - distance / (radius + 2.0D), 0.25D, 1.0D);
                victim.hurt(source, AbilityHelper.damage(16.0D) * falloff);

                Vec3 knock = victim.position().subtract(center);
                if (knock.lengthSqr() < 1.0E-4D) {
                    knock = new Vec3(0.0D, 1.0D, 0.0D);
                }
                knock = knock.normalize().scale(1.6D).add(0.0D, 0.9D, 0.0D);
                AbilityHelper.push(victim, knock);
            }

            AbilityHelper.particles(level, ParticleTypes.EXPLOSION_EMITTER, center, 1, 0.0D, 0.0D);
            AbilityHelper.particles(level, ParticleTypes.CLOUD, center, 80, 3.0D, 0.25D);
            AbilityHelper.playSound(level, center, SoundEvents.GENERIC_EXPLODE, 6.0F, 0.6F);
        }
    },

    /** 呪詛の咆哮：範囲内にウィザー効果と鈍化を付与 */
    WITHER_ROAR("wither_roar", 35, 120, 160, 3) {
        @Override
        public void cast(ServerLevel level, LivingEntity caster, @Nullable LivingEntity target) {
            Vec3 center = caster.position().add(0.0D, caster.getBbHeight() * 0.5D, 0.0D);
            double radius = 12.0D;
            DamageSource source = AbilityHelper.source(level, caster);

            for (LivingEntity victim : AbilityHelper.targetsAround(level, caster, center, radius)) {
                victim.hurt(source, AbilityHelper.damage(8.0D));
                victim.addEffect(new MobEffectInstance(MobEffects.WITHER, 200, 1));
                victim.addEffect(new MobEffectInstance(MobEffects.MOVEMENT_SLOWDOWN, 120, 1));
                victim.addEffect(new MobEffectInstance(MobEffects.WEAKNESS, 120, 0));
            }

            AbilityHelper.particles(level, ParticleTypes.SMOKE, center, 120, 5.0D, 0.05D);
            AbilityHelper.particles(level, ParticleTypes.SOUL_FIRE_FLAME, center, 60, 4.0D, 0.02D);
            AbilityHelper.playSound(level, center, SoundEvents.GHAST_SCREAM, 8.0F, 0.4F);
            AbilityHelper.playSound(level, center, SoundEvents.WITHER_SPAWN, 3.0F, 1.4F);
        }
    },

    /** 獄炎の柱：狙った地点に炎の柱を発生させ、周囲を燃やす */
    FLAME_PILLAR("flame_pillar", 30, 100, 110, 3) {
        @Override
        public void cast(ServerLevel level, LivingEntity caster, @Nullable LivingEntity target) {
            Vec3 base = AbilityHelper.aimPoint(caster, target, 32.0D);
            double radius = 4.0D;
            DamageSource source = AbilityHelper.source(level, caster);

            for (int i = 0; i < 24; i++) {
                Vec3 point = base.add(0.0D, i * 0.5D, 0.0D);
                AbilityHelper.particles(level, ParticleTypes.FLAME, point, 12, 1.2D, 0.05D);
                AbilityHelper.particles(level, ParticleTypes.SOUL_FIRE_FLAME, point, 6, 1.0D, 0.02D);
            }

            Vec3 center = base.add(0.0D, 3.0D, 0.0D);
            for (LivingEntity victim : AbilityHelper.targetsAround(level, caster, center, radius + 3.0D)) {
                victim.hurt(source, AbilityHelper.damage(12.0D));
                victim.setSecondsOnFire(10);
                AbilityHelper.push(victim, new Vec3(0.0D, 0.6D, 0.0D));
            }

            AbilityHelper.playSound(level, base, SoundEvents.FIRECHARGE_USE, 5.0F, 0.5F);
            AbilityHelper.playSound(level, base, SoundEvents.GHAST_WARN, 5.0F, 0.6F);
        }
    };

    private final String id;
    private final int chargeTicks;
    private final int mobCooldown;
    private final int playerCooldown;
    private final int durabilityCost;

    GhastAbility(String id, int chargeTicks, int mobCooldown, int playerCooldown, int durabilityCost) {
        this.id = id;
        this.chargeTicks = chargeTicks;
        this.mobCooldown = mobCooldown;
        this.playerCooldown = playerCooldown;
        this.durabilityCost = durabilityCost;
    }

    /** 技の本体。サーバー側でのみ呼ぶこと。 */
    public abstract void cast(ServerLevel level, LivingEntity caster, @Nullable LivingEntity target);

    public String getId() {
        return this.id;
    }

    public int getChargeTicks() {
        return this.chargeTicks;
    }

    public int getMobCooldown() {
        return this.mobCooldown;
    }

    public int getPlayerCooldown() {
        return this.playerCooldown;
    }

    public int getDurabilityCost() {
        return this.durabilityCost;
    }

    public String getTranslationKey() {
        return "ability." + MightyGhastMod.MOD_ID + "." + this.id;
    }

    public Component getDisplayName() {
        return Component.translatable(this.getTranslationKey()).withStyle(ChatFormatting.LIGHT_PURPLE);
    }

    public static final GhastAbility[] VALUES = values();

    public static GhastAbility random(RandomSource random) {
        return VALUES[random.nextInt(VALUES.length)];
    }

    @Nullable
    public static GhastAbility byId(String id) {
        for (GhastAbility ability : VALUES) {
            if (ability.id.equalsIgnoreCase(id)) {
                return ability;
            }
        }
        return null;
    }

    public static GhastAbility byIndex(int index) {
        return VALUES[Mth.clamp(index, 0, VALUES.length - 1)];
    }

    @Override
    public String toString() {
        return this.id.toLowerCase(Locale.ROOT);
    }
}
