import React, { useEffect, useState } from "react";
import { View, ScrollView, TextInput, Pressable } from "react-native";
import Icon from "@/ui/components/Icon";
import Typography from "@/ui/components/Typography";
import Stack from "@/ui/components/Stack";
import List from "@/ui/components/List";
import Item from "@/ui/components/Item";
import { router } from "expo-router";
import { useTheme } from "@react-navigation/native";
import { NativeHeaderPressable, NativeHeaderSide, NativeHeaderTitle } from "@/ui/components/NativeHeader";
import { Papicons } from "@getpapillon/papicons";
import { getManager } from "@/services/shared";
import { Capabilities } from "@/services/shared/types";
import { Chat, Message } from "@/services/shared/chat";
import { t } from "i18next";

export default function ChatsView() {
    const [chats, setChats] = useState<Chat[]>([]);
    const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [text, setText] = useState<string>("");
    const [canReply, setCanReply] = useState<boolean>(false);

    const theme = useTheme();

    useEffect(() => {
        (async () => {
            const manager = getManager();
            try {
                setLoading(true);
                const fetched = await manager.getChats();
                setChats(fetched ?? []);
            } catch (err) {
                // ignore silently
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const openChat = async (chat: Chat) => {
        setLoading(true);
        try {
            const manager = getManager();
            const msgs = await manager.getChatMessages(chat);
            setMessages(msgs ?? []);
            setSelectedChat(chat);
            const reply = manager.clientHasCapatibility(Capabilities.CHAT_REPLY, chat.createdByAccount);
            setCanReply(reply);
        } catch (err) {
            // ignore
        } finally {
            setLoading(false);
        }
    };

    const send = async () => {
        if (!selectedChat || !text.trim()) return;
        setLoading(true);
        try {
            const manager = getManager();
            await manager.sendMessageInChat(selectedChat, text.trim());
            setText("");
            const msgs = await manager.getChatMessages(selectedChat);
            setMessages(msgs ?? []);
        } catch (err) {
            // ignore
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <NativeHeaderSide side="Left">
                <NativeHeaderPressable onPress={() => router.back()}>
                    <Icon papicon opacity={0.5}>
                        <Papicons name={"Cross"} />
                    </Icon>
                </NativeHeaderPressable>
            </NativeHeaderSide>

            <NativeHeaderTitle>
                <Typography variant="navigation">{t("Tab_Chats")}</Typography>
            </NativeHeaderTitle>

            <View style={{ flex: 1, padding: 16 }}>
                {!selectedChat ? (
                    <ScrollView>
                        <List>
                            {chats.map((chat) => (
                                <Item key={chat.id} onPress={() => openChat(chat)}>
                                    <Typography variant="title">{chat.subject || chat.recipient || t("Chat_NoTitle")}</Typography>
                                    <Typography color="secondary">{new Date(chat.date).toLocaleString()}</Typography>
                                </Item>
                            ))}
                        </List>
                    </ScrollView>
                ) : (
                    <View style={{ flex: 1 }}>
                        <ScrollView contentContainerStyle={{ gap: 8 }}>
                            {messages.map((m) => (
                                <Item key={m.id}>
                                    <Typography weight="semibold">{m.author}</Typography>
                                    <Typography>{m.content}</Typography>
                                    <Typography color="secondary">{new Date(m.date).toLocaleString()}</Typography>
                                </Item>
                            ))}
                        </ScrollView>

                        {canReply ? (
                            <Stack direction="horizontal" style={{ gap: 8, marginTop: 8 }}>
                                <TextInput
                                    style={{ flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border }}
                                    value={text}
                                    onChangeText={setText}
                                    placeholder={t("Chat_Write_Placeholder")}
                                />
                                <Pressable onPress={send} style={{ padding: 12, borderRadius: 8, backgroundColor: theme.colors.primary }}>
                                    <Typography color="#FFF">{t("Chat_Send") || "Envoyer"}</Typography>
                                </Pressable>
                            </Stack>
                        ) : (
                            <View style={{ marginTop: 8 }}>
                                <Typography color="secondary">{t("Feature_Soon")}</Typography>
                            </View>
                        )}
                    </View>
                )}
            </View>
        </>
    );
}
