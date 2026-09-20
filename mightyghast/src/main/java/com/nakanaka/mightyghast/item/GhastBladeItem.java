package com.nakanaka.mightyghast.item;

import com.nakanaka.mightyghast.MightyGhastConfig;
import com.nakanaka.mightyghast.ability.GhastAbility;
import net.minecraft.ChatFormatting;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.nbt.Tag;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResultHolder;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.SwordItem;
import net.minecraft.world.item.TooltipFlag;
import net.minecraft.world.level.Level;

import javax.annotation.Nullable;
import java.util.List;

/**
 * ガストブレード。
 *
 * <ul>
 *     <li>左クリック（空振り / エンティティへの攻撃）… ガストの技を1つ放つ</li>
 *     <li>右クリック … 使用する技を切り替える（ランダム ⇔ 各技の固定）</li>
 * </ul>
 */
public class GhastBladeItem extends SwordItem {

    private static final String TAG_ABILITY = "SelectedAbility";

    public GhastBladeItem(Properties properties) {
        super(ModTiers.GHAST, 5, -2.6F, properties);
    }

    // ------------------------------------------------------------------
    // 技の選択（NBT）
    // ------------------------------------------------------------------
    @Nullable
    public static GhastAbility getSelected(ItemStack stack) {
        CompoundTag tag = stack.getTag();
        if (tag == null || !tag.contains(TAG_ABILITY, Tag.TAG_STRING)) {
            return null; // null = ランダム
        }
        return GhastAbility.byId(tag.getString(TAG_ABILITY));
    }

    public static void setSelected(ItemStack stack, @Nullable GhastAbility ability) {
        if (ability == null) {
            CompoundTag tag = stack.getTag();
            if (tag != null) {
                tag.remove(TAG_ABILITY);
            }
        } else {
            stack.getOrCreateTag().putString(TAG_ABILITY, ability.getId());
        }
    }

    /** ランダム → 各技 → ランダム … の順に切り替える */
    public static void cycleSelected(ItemStack stack) {
        GhastAbility current = getSelected(stack);
        if (current == null) {
            setSelected(stack, GhastAbility.VALUES[0]);
            return;
        }
        int next = current.ordinal() + 1;
        setSelected(stack, next >= GhastAbility.VALUES.length ? null : GhastAbility.VALUES[next]);
    }

    // ------------------------------------------------------------------
    // 技の発動（サーバー側でのみ呼ぶ）
    // ------------------------------------------------------------------
    public static boolean releaseAbility(Player player, InteractionHand hand) {
        ItemStack stack = player.getItemInHand(hand);
        if (!(stack.getItem() instanceof GhastBladeItem)) {
            return false;
        }
        if (!(player.level() instanceof ServerLevel level)) {
            return false;
        }
        if (player.getCooldowns().isOnCooldown(stack.getItem())) {
            return false;
        }

        GhastAbility ability = getSelected(stack);
        if (ability == null) {
            ability = GhastAbility.random(player.getRandom());
        }

        ability.cast(level, player, null);

        MightyGhastConfig config = MightyGhastConfig.get();
        int cooldown = (int) (ability.getPlayerCooldown() * config.swordCooldownMultiplier.get());
        if (cooldown > 0) {
            player.getCooldowns().addCooldown(stack.getItem(), cooldown);
        }

        if (config.swordCostsDurability.get() && !player.getAbilities().instabuild) {
            stack.hurtAndBreak(ability.getDurabilityCost(), player,
                    living -> living.broadcastBreakEvent(hand));
        }

        player.causeFoodExhaustion(1.5F);
        player.displayClientMessage(
                Component.translatable("message.mightyghast.cast", ability.getDisplayName()), true);
        return true;
    }

    // ------------------------------------------------------------------
    // 入力
    // ------------------------------------------------------------------
    @Override
    public boolean onLeftClickEntity(ItemStack stack, Player player, Entity entity) {
        if (!player.level().isClientSide()) {
            releaseAbility(player, InteractionHand.MAIN_HAND);
        }
        return false; // 通常の近接ダメージもそのまま入る
    }

    @Override
    public InteractionResultHolder<ItemStack> use(Level level, Player player, InteractionHand hand) {
        ItemStack stack = player.getItemInHand(hand);
        if (!level.isClientSide()) {
            cycleSelected(stack);
            GhastAbility selected = getSelected(stack);
            Component name = selected == null
                    ? Component.translatable("message.mightyghast.random").withStyle(ChatFormatting.AQUA)
                    : selected.getDisplayName();
            player.displayClientMessage(Component.translatable("message.mightyghast.switch", name), true);
        }
        return InteractionResultHolder.sidedSuccess(stack, level.isClientSide());
    }

    // ------------------------------------------------------------------
    // 見た目・ツールチップ
    // ------------------------------------------------------------------
    @Override
    public boolean isFoil(ItemStack stack) {
        return true;
    }

    @Override
    public void appendHoverText(ItemStack stack, @Nullable Level level, List<Component> tooltip, TooltipFlag flag) {
        super.appendHoverText(stack, level, tooltip, flag);

        GhastAbility selected = getSelected(stack);
        Component name = selected == null
                ? Component.translatable("message.mightyghast.random").withStyle(ChatFormatting.AQUA)
                : selected.getDisplayName();

        tooltip.add(Component.translatable("tooltip.mightyghast.ghast_blade.selected", name)
                .withStyle(ChatFormatting.GRAY));
        tooltip.add(Component.translatable("tooltip.mightyghast.ghast_blade.left_click")
                .withStyle(ChatFormatting.DARK_GRAY));
        tooltip.add(Component.translatable("tooltip.mightyghast.ghast_blade.right_click")
                .withStyle(ChatFormatting.DARK_GRAY));
    }
}
