package com.nakanaka.mightyghast.item;

import com.nakanaka.mightyghast.MightyGhastMod;
import com.nakanaka.mightyghast.registry.ModItems;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.tags.BlockTags;
import net.minecraft.world.item.Tier;
import net.minecraft.world.item.Tiers;
import net.minecraft.world.item.crafting.Ingredient;
import net.minecraftforge.common.ForgeTier;
import net.minecraftforge.common.TierSortingRegistry;

import java.util.List;

public final class ModTiers {

    /** ネザライト超えの性能。耐久 2400 / 追加攻撃力 5.0 / エンチャント適性 20 */
    public static final Tier GHAST = new ForgeTier(
            4,
            2400,
            9.5F,
            5.0F,
            20,
            BlockTags.NEEDS_NETHERITE_TOOL,
            () -> Ingredient.of(ModItems.GHAST_INGOT.get()));

    public static void register() {
        TierSortingRegistry.registerTier(
                GHAST,
                new ResourceLocation(MightyGhastMod.MOD_ID, "ghast"),
                List.<Object>of(Tiers.NETHERITE),
                List.<Object>of());
    }

    private ModTiers() {
    }
}
