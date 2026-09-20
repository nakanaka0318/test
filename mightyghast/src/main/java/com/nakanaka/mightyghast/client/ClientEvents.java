package com.nakanaka.mightyghast.client;

import com.nakanaka.mightyghast.MightyGhastMod;
import com.nakanaka.mightyghast.item.GhastBladeItem;
import com.nakanaka.mightyghast.network.ModNetwork;
import com.nakanaka.mightyghast.network.SwingBladePacket;
import net.minecraft.world.InteractionHand;
import net.minecraftforge.api.distmarker.Dist;
import net.minecraftforge.event.entity.player.PlayerInteractEvent;
import net.minecraftforge.eventbus.api.SubscribeEvent;
import net.minecraftforge.fml.common.Mod;

/** 空振り左クリックを拾ってサーバーへ通知するクライアント専用ハンドラ。 */
@Mod.EventBusSubscriber(modid = MightyGhastMod.MOD_ID, value = Dist.CLIENT,
        bus = Mod.EventBusSubscriber.Bus.FORGE)
public final class ClientEvents {

    private ClientEvents() {
    }

    @SubscribeEvent
    public static void onLeftClickEmpty(PlayerInteractEvent.LeftClickEmpty event) {
        if (event.getHand() != InteractionHand.MAIN_HAND) {
            return;
        }
        if (event.getItemStack().getItem() instanceof GhastBladeItem) {
            ModNetwork.CHANNEL.sendToServer(new SwingBladePacket());
        }
    }
}
