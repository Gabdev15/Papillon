import React, { useCallback, useEffect, useState } from "react";
import { View, TextInput, Pressable, KeyboardAvoidingView, Platform, Linking } from "react-native";
import Icon from "@/ui/components/Icon";
import Typography from "@/ui/components/Typography";
import Stack from "@/ui/components/Stack";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "@react-navigation/native";
import { Papicons } from "@getpapillon/papicons";
import { getManager } from "@/services/shared";
import { Capabilities } from "@/services/shared/types";
import { Chat, Message } from "@/services/shared/chat";
import { t } from "i18next";
import Avatar from "@/ui/components/Avatar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScrollView } from "react-native-gesture-handler";
import { getInitials } from "@/utils/chats/initials";
import { getProfileColorByName } from "@/utils/chats/colors";
import { NativeHeaderPressable, NativeHeaderSide, NativeHeaderTitle } from "@/ui/components/NativeHeader";

const ChatModal = () => {
    const search = useLocalSearchParams();
    const chatParams = JSON.parse(String(search.chat)) as Omit<Chat, 'ref'>;
    const router = useRouter();

    const [chat, setChat] = useState<Chat | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [text, setText] = useState<string>("");
    const [canReply, setCanReply] = useState<boolean>(false);

    const theme = useTheme();
    const colors = theme.colors;
    const insets = useSafeAreaInsets();

    const stripHtmlTags = (html?: string) => {
        if (!html) return "";
        return html.replace(/<[^>]*>/g, "");
    };

    const decodeHtmlEntities = (text?: string) => {
        if (!text) return "";
        let t = String(text);
        t = t
            .replace(/&nbsp;|&#160;/g, " ")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");
        t = t.replace(/&#(\d+);/g, (_m, code) => {
            const num = Number(code);
            return Number.isNaN(num) ? "" : String.fromCharCode(num);
        });
        t = t.replace(/&#x([0-9A-Fa-f]+);/g, (_m, hex) => {
            const num = parseInt(hex, 16);
            return Number.isNaN(num) ? "" : String.fromCharCode(num);
        });
        return t.replace(/\s{2,}/g, " ").trim();
    };

    const fetchMessages = useCallback(async () => {
        setLoading(true);
        try {
            const manager = getManager();
            // Récupérer la liste des chats pour trouver celui avec le ref
            const chats = await manager.getChats();
            const fullChat = chats?.find(c => c.id === chatParams.id);
            
            if (fullChat) {
                setChat(fullChat);
                const msgs = await manager.getChatMessages(fullChat);
                setMessages(msgs ?? []);
                const reply = manager.clientHasCapatibility(Capabilities.CHAT_REPLY, fullChat.createdByAccount);
                setCanReply(reply);
            }
        } catch {
            // ignore
        } finally {
            setLoading(false);
        }
    }, [chatParams.id]);

    useEffect(() => {
        fetchMessages();
    }, []);

    const send = async () => {
        if (!chat || !text.trim()) return;
        setLoading(true);
        try {
            const manager = getManager();
            await manager.sendMessageInChat(chat, text.trim());
            setText("");
            const msgs = await manager.getChatMessages(chat);
            setMessages(msgs ?? []);
        } catch {
            // ignore
        } finally {
            setLoading(false);
        }
    };

    const chatTitle = chatParams.subject || chatParams.recipient || t("Chat_NoTitle");

    return (
        <>
            <NativeHeaderSide side="Left">
                <NativeHeaderPressable onPress={() => router.back()}>
                    <Icon papicon opacity={0.5}>
                        <Papicons name={"ArrowLeft"} />
                    </Icon>
                </NativeHeaderPressable>
            </NativeHeaderSide>

            <NativeHeaderTitle>
                <></>
            </NativeHeaderTitle>

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
            >
                <ScrollView
                    contentContainerStyle={{
                        paddingBottom: 8,
                        paddingHorizontal: 16,
                        paddingTop: 80,
                    }}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* En-tête comme dans les actualités */}
                    <Stack gap={10} style={{ marginBottom: 24 }}>
                        <Typography variant="h3">
                            {chatTitle}
                        </Typography>

                        <Stack direction="horizontal" hAlign="center">
                            <Stack direction="horizontal" gap={8} inline flex hAlign="center">
                                <Avatar initials={getInitials(chatParams.creator || chatParams.recipient || "")} size={28} />
                                <Typography nowrap variant="body2">
                                    {chatParams.creator || chatParams.recipient || ""}
                                </Typography>
                            </Stack>

                            <Typography nowrap variant="body2" color="secondary">
                                {new Date(chatParams.date).toLocaleDateString(undefined, {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                })}
                            </Typography>
                        </Stack>
                    </Stack>

                    {/* Messages */}
                    {messages.map((m) => {
                        const isOutgoing = chatParams.creator === m.author;
                        const cleaned = decodeHtmlEntities(stripHtmlTags(m.content));
                        const msgProfileColor = getProfileColorByName(m.author);

                        return (
                            <View key={m.id} style={{ marginVertical: 4 }}>
                                <View
                                    style={{
                                        flexDirection: "row",
                                        justifyContent: isOutgoing ? "flex-end" : "flex-start",
                                        paddingHorizontal: 4,
                                    }}
                                >
                                    {!isOutgoing && (
                                        <Avatar
                                            size={32}
                                            color={msgProfileColor}
                                            initials={getInitials(m.author)}
                                            style={{ marginRight: 8, alignSelf: "flex-end" }}
                                        />
                                    )}
                                    <View
                                        style={{
                                            maxWidth: "75%",
                                            backgroundColor: isOutgoing ? colors.primary : colors.card,
                                            paddingVertical: 10,
                                            paddingHorizontal: 12,
                                            borderRadius: 18,
                                            borderTopRightRadius: isOutgoing ? 6 : 18,
                                            borderTopLeftRadius: isOutgoing ? 18 : 6,
                                        }}
                                    >
                                        {!isOutgoing && (
                                            <Typography weight="semibold" variant="caption" color={colors.text} style={{ marginBottom: 2 }}>
                                                {m.author}
                                            </Typography>
                                        )}
                                        <Typography color={isOutgoing ? "#FFFFFF" : undefined}>
                                            {cleaned}
                                        </Typography>
                                        <Typography color={isOutgoing ? "#FFFFFF99" : "secondary"} variant="caption" style={{ marginTop: 4 }}>
                                            {new Date(m.date).toLocaleString()}
                                        </Typography>
                                    </View>
                                </View>

                                {/* Pièces jointes en dessous de la bulle */}
                                {m.attachments && m.attachments.length > 0 && (
                                    <View style={{
                                        marginTop: 6,
                                        marginLeft: isOutgoing ? 0 : 44,
                                        marginRight: isOutgoing ? 4 : 0,
                                        gap: 4,
                                        alignItems: isOutgoing ? "flex-end" : "flex-start",
                                    }}>
                                        {m.attachments.map((attachment, idx) => (
                                            <Pressable
                                                key={idx}
                                                onPress={() => Linking.openURL(attachment.url)}
                                                style={{
                                                    flexDirection: "row",
                                                    alignItems: "center",
                                                    gap: 8,
                                                    backgroundColor: colors.text + "12",
                                                    paddingVertical: 8,
                                                    paddingHorizontal: 12,
                                                    borderRadius: 12,
                                                    maxWidth: "75%",
                                                }}
                                            >
                                                <Icon size={18} opacity={0.6}>
                                                    <Papicons name={"Paper"} />
                                                </Icon>
                                                <Typography
                                                    variant="caption"
                                                    weight="medium"
                                                    color="secondary"
                                                    numberOfLines={1}
                                                    style={{ flex: 1 }}
                                                >
                                                    {attachment.name}
                                                </Typography>
                                            </Pressable>
                                        ))}
                                    </View>
                                )}
                            </View>
                        );
                    })}
                </ScrollView>

                <View style={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 8, paddingTop: 8 }}>
                    {canReply ? (
                        <Stack
                            height={42}
                            style={{
                                borderWidth: 0,
                                overflow: "hidden",
                                backgroundColor: colors.text + "16",
                            }}
                            radius={300}
                            direction="horizontal"
                            hAlign="center"
                            vAlign="center"
                            gap={10}
                            padding={[14, 0]}
                        >
                            <TextInput
                                value={text}
                                onChangeText={setText}
                                placeholder={t("Chat_Write_Placeholder")}
                                placeholderTextColor={colors.text + "77"}
                                style={{
                                    flex: 1,
                                    height: "100%",
                                    fontSize: 17,
                                    color: colors.text,
                                    fontFamily: "semibold",
                                }}
                            />
                            <Pressable onPress={send} disabled={!text.trim()}>
                                <Icon size={24} opacity={text.trim() ? 1 : 0.5}>
                                    <Papicons name={"TextBubble"} />
                                </Icon>
                            </Pressable>
                        </Stack>
                    ) : (
                        <Stack
                            height={42}
                            style={{
                                backgroundColor: colors.text + "08",
                            }}
                            radius={300}
                            direction="horizontal"
                            hAlign="center"
                            vAlign="center"
                            padding={[14, 0]}
                        >
                            <Typography variant="body2" color="secondary">
                                {t("Chat_Reply_Disabled")}
                            </Typography>
                        </Stack>
                    )}
                </View>
            </KeyboardAvoidingView>
        </>
    );
};

export default ChatModal;

