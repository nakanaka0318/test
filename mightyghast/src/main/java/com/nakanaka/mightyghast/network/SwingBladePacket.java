package com.nakanaka.mightyghast.network;

import com.nakanaka.mightyghast.item.GhastBladeItem;
import net.minecraft.network.FriendlyByteBuf;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.InteractionHand;
import net.minecraftforge.network.NetworkEvent;

import java.util.function.Supplier;

/**
 * 「空振り左クリック」はクライアントでしか検知できないため、
 * サーバーへ通知して技を発動させるパケット。
 */
public class SwingBladePacket {

    public SwingBladePacket() {
    }

    public SwingBladePacket(FriendlyByteBuf buf) {
        // 送るデータなし
    }

    public void encode(FriendlyByteBuf buf) {
        // 送るデータなし
    }

    public static void handle(SwingBladePacket message, Supplier<NetworkEvent.Context> contextSupplier) {
        NetworkEvent.Context context = contextSupplier.get();
        ServerPlayer player = context.getSender();
        if (player != null) {
            GhastBladeItem.releaseAbility(player, InteractionHand.MAIN_HAND);
        }
        context.setPacketHandled(true);
    }
}
