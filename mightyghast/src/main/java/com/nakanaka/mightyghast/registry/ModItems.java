package com.nakanaka.mightyghast.registry;

import com.nakanaka.mightyghast.MightyGhastMod;
import com.nakanaka.mightyghast.item.GhastBladeItem;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.Rarity;
import net.minecraftforge.registries.DeferredRegister;
import net.minecraftforge.registries.ForgeRegistries;
import net.minecraftforge.registries.RegistryObject;

public final class ModItems {

    public static final DeferredRegister<Item> ITEMS =
            DeferredRegister.create(ForgeRegistries.ITEMS, MightyGhastMod.MOD_ID);

    /** ガストインゴット：強化ガストのドロップ品 */
    public static final RegistryObject<Item> GHAST_INGOT = ITEMS.register("ghast_ingot",
            () -> new Item(new Item.Properties().rarity(Rarity.RARE).fireResistant()));

    /** ガストブレード：左クリックでガストの技を放つ剣 */
    public static final RegistryObject<Item> GHAST_BLADE = ITEMS.register("ghast_blade",
            () -> new GhastBladeItem(new Item.Properties().rarity(Rarity.EPIC).fireResistant()));

    private ModItems() {
    }
}
