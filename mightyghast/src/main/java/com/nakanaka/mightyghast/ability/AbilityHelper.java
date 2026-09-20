package com.nakanaka.mightyghast.ability;

import com.nakanaka.mightyghast.MightyGhastConfig;
import net.minecraft.core.particles.ParticleOptions;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.sounds.SoundEvent;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.damagesource.DamageSource;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.TamableAnimal;
import net.minecraft.world.entity.monster.Ghast;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.phys.AABB;
import net.minecraft.world.phys.HitResult;
import net.minecraft.world.phys.Vec3;

import javax.annotation.Nullable;
import java.util.List;

/** 技の実装で使う共通処理。 */
public final class AbilityHelper {

    private AbilityHelper() {
    }

    /** 狙う方向。mob は target へ、プレイヤーは視線方向へ。 */
    public static Vec3 aimDirection(LivingEntity caster, @Nullable LivingEntity target) {
        if (target != null) {
            Vec3 from = caster.getEyePosition();
            Vec3 to = target.position().add(0.0D, target.getBbHeight() * 0.5D, 0.0D);
            Vec3 diff = to.subtract(from);
            if (diff.lengthSqr() > 1.0E-4D) {
                return diff.normalize();
            }
        }
        return caster.getLookAngle().normalize();
    }

    /** 狙う地点。mob は target の足元、プレイヤーは視線の先（ブロックに当たればその位置）。 */
    public static Vec3 aimPoint(LivingEntity caster, @Nullable LivingEntity target, double range) {
        if (target != null) {
            return target.position();
        }
        HitResult hit = caster.pick(range, 1.0F, false);
        if (hit.getType() != HitResult.Type.MISS) {
            return hit.getLocation();
        }
        return caster.getEyePosition().add(caster.getLookAngle().scale(range));
    }

    /** 発射位置（自分に当たらないよう少し前方へ） */
    public static Vec3 muzzle(LivingEntity caster, Vec3 direction) {
        return caster.getEyePosition().add(direction.scale(caster.getBbWidth() * 0.5D + 1.5D));
    }

    public static DamageSource source(ServerLevel level, LivingEntity caster) {
        if (caster instanceof Player player) {
            return level.damageSources().playerAttack(player);
        }
        return level.damageSources().mobAttack(caster);
    }

    /** コンフィグのダメージ倍率を適用 */
    public static float damage(double base) {
        return (float) (base * MightyGhastConfig.get().abilityDamageMultiplier.get());
    }

    public static boolean isValidTarget(LivingEntity caster, LivingEntity other) {
        if (other == caster || !other.isAlive() || other.isSpectator()) {
            return false;
        }
        if (caster.isAlliedTo(other)) {
            return false;
        }
        if (caster instanceof Ghast && other instanceof Ghast) {
            return false; // ガスト同士は撃ち合わない
        }
        if (other instanceof TamableAnimal tamable && tamable.isOwnedBy(caster)) {
            return false; // 自分のペットは巻き込まない
        }
        if (caster instanceof Player && other instanceof Player) {
            return caster.level().getServer() == null || caster.level().getServer().isPvpAllowed();
        }
        if (other instanceof Player player) {
            return !player.isCreative();
        }
        return true;
    }

    public static List<LivingEntity> targetsAround(ServerLevel level, LivingEntity caster, Vec3 center, double radius) {
        AABB box = new AABB(center.x - radius, center.y - radius, center.z - radius,
                center.x + radius, center.y + radius, center.z + radius);
        return level.getEntitiesOfClass(LivingEntity.class, box,
                entity -> isValidTarget(caster, entity) && entity.position().distanceTo(center) <= radius);
    }

    /** プレイヤーにも効くノックバック（hurtMarked でクライアントへ同期） */
    public static void push(LivingEntity entity, Vec3 motion) {
        entity.setDeltaMovement(entity.getDeltaMovement().add(motion));
        entity.hurtMarked = true;
    }

    public static void playSound(ServerLevel level, Vec3 pos, SoundEvent sound, float volume, float pitch) {
        level.playSound(null, pos.x, pos.y, pos.z, sound, SoundSource.HOSTILE, volume, pitch);
    }

    public static void particles(ServerLevel level, ParticleOptions particle, Vec3 pos,
                                 int count, double spread, double speed) {
        level.sendParticles(particle, pos.x, pos.y, pos.z, count, spread, spread, spread, speed);
    }
}
