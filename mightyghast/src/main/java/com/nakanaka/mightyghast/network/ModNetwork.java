package com.nakanaka.mightyghast.network;

import com.nakanaka.mightyghast.MightyGhastMod;
import net.minecraft.resources.ResourceLocation;
import net.minecraftforge.network.NetworkDirection;
import net.minecraftforge.network.NetworkRegistry;
import net.minecraftforge.network.simple.SimpleChannel;

public final class ModNetwork {

    private static final String PROTOCOL_VERSION = "1";

    public static final SimpleChannel CHANNEL = NetworkRegistry.ChannelBuilder
            .named(new ResourceLocation(MightyGhastMod.MOD_ID, "main"))
            .networkProtocolVersion(() -> PROTOCOL_VERSION)
            .clientAcceptedVersions(PROTOCOL_VERSION::equals)
            .serverAcceptedVersions(PROTOCOL_VERSION::equals)
            .simpleChannel();

    public static void register() {
        int id = 0;
        CHANNEL.messageBuilder(SwingBladePacket.class, id++, NetworkDirection.PLAY_TO_SERVER)
                .encoder(SwingBladePacket::encode)
                .decoder(SwingBladePacket::new)
                .consumerMainThread(SwingBladePacket::handle)
                .add();
    }

    private ModNetwork() {
    }
}
