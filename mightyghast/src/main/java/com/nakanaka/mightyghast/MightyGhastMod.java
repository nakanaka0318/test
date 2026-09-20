package com.nakanaka.mightyghast;

import com.mojang.logging.LogUtils;
import com.nakanaka.mightyghast.item.ModTiers;
import com.nakanaka.mightyghast.network.ModNetwork;
import com.nakanaka.mightyghast.registry.ModCreativeTabs;
import com.nakanaka.mightyghast.registry.ModItems;
import net.minecraftforge.eventbus.api.IEventBus;
import net.minecraftforge.fml.ModLoadingContext;
import net.minecraftforge.fml.common.Mod;
import net.minecraftforge.fml.config.ModConfig;
import net.minecraftforge.fml.event.lifecycle.FMLCommonSetupEvent;
import net.minecraftforge.fml.javafmlmod.FMLJavaModLoadingContext;
import org.slf4j.Logger;

/**
 * Mighty Ghast - ガストをウィザー級のボスに強化し、ガストインゴットとガストブレードを追加する Mod。
 */
@Mod(MightyGhastMod.MOD_ID)
public class MightyGhastMod {

    public static final String MOD_ID = "mightyghast";
    public static final Logger LOGGER = LogUtils.getLogger();

    public MightyGhastMod() {
        IEventBus modBus = FMLJavaModLoadingContext.get().getModEventBus();

        ModTiers.register();
        ModItems.ITEMS.register(modBus);
        ModCreativeTabs.TABS.register(modBus);

        modBus.addListener(this::commonSetup);

        ModLoadingContext.get().registerConfig(ModConfig.Type.COMMON, MightyGhastConfig.SPEC);
    }

    private void commonSetup(final FMLCommonSetupEvent event) {
        event.enqueueWork(ModNetwork::register);
        LOGGER.info("[Mighty Ghast] セットアップ完了。ガストが本気を出します。");
    }
}
