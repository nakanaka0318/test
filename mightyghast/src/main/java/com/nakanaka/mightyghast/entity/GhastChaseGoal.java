package com.nakanaka.mightyghast.entity;

import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.ai.goal.Goal;
import net.minecraft.world.entity.monster.Ghast;

import java.util.EnumSet;

/**
 * ターゲットを追い続ける移動 AI。バニラのランダム浮遊より優先され、
 * 一定の高度・距離を保ちながらプレイヤーに張り付く。
 */
public class GhastChaseGoal extends Goal {

    private static final double PREFERRED_DISTANCE = 14.0D;
    private static final double PREFERRED_HEIGHT = 7.0D;

    private final Ghast ghast;
    private int repathCooldown;

    public GhastChaseGoal(Ghast ghast) {
        this.ghast = ghast;
        this.setFlags(EnumSet.of(Goal.Flag.MOVE));
    }

    @Override
    public boolean canUse() {
        LivingEntity target = this.ghast.getTarget();
        return target != null && target.isAlive();
    }

    @Override
    public boolean canContinueToUse() {
        return this.canUse();
    }

    @Override
    public void start() {
        this.repathCooldown = 0;
    }

    @Override
    public void tick() {
        LivingEntity target = this.ghast.getTarget();
        if (target == null) {
            return;
        }

        if (--this.repathCooldown > 0) {
            return;
        }
        this.repathCooldown = 20;

        double dx = this.ghast.getX() - target.getX();
        double dz = this.ghast.getZ() - target.getZ();
        double horizontal = Math.sqrt(dx * dx + dz * dz);

        double wantedX;
        double wantedZ;
        if (horizontal < 1.0E-3D) {
            wantedX = target.getX() + PREFERRED_DISTANCE;
            wantedZ = target.getZ();
        } else {
            // 目標距離まで詰める / 離れすぎたら近づく
            double scale = PREFERRED_DISTANCE / horizontal;
            wantedX = target.getX() + dx * scale;
            wantedZ = target.getZ() + dz * scale;
        }

        double wantedY = target.getY() + PREFERRED_HEIGHT;

        this.ghast.getMoveControl().setWantedPosition(wantedX, wantedY, wantedZ, 1.0D);
    }
}
