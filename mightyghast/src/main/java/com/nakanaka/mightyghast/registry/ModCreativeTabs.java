package com.nakanaka.mightyghast.registry;

import com.nakanaka.mightyghast.MightyGhastMod;
import net.minecraft.core.registries.Registries;
import net.minecraft.network.chat.Component;
import net.minecraft.world.item.CreativeModeTab;
import net.minecraft.world.item.ItemStack;
import net.minecraftforge.registries.DeferredRegister;
import net.minecraftforge.registries.RegistryObject;

public final class ModCreativeTabs {

    public static final DeferredRegister<CreativeModeTab> TABS =
            DeferredRegister.create(Registries.CREATIVE_MODE_TAB, MightyGhastMod.MOD_ID);

    public static final RegistryObject<CreativeModeTab> MAIN = TABS.register("main",
            () -> CreativeModeTab.builder()
                    .title(Component.translatable("itemGroup." + MightyGhastMod.MOD_ID))
                    .icon(() -> new ItemStack(ModItems.GHAST_INGOT.get()))
                    .displayItems((params, output) -> {
                        output.accept(ModItems.GHAST_INGOT.get());
                        output.accept(ModItems.GHAST_BLADE.get());
                    })
                    .build());

    private ModCreativeTabs() {
    }
}
