import React, { useCallback, useEffect, useState, useRef } from "react";
import { View, TextInput, Pressable, KeyboardAvoidingView, Platform, Linking, ScrollView } from "react-native";
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
import { getInitials } from "@/utils/chats/initials";
import { getProfileColorByName } from "@/utils/chats/colors";
import { NativeHeaderPressable, NativeHeaderSide, NativeHeaderTitle } from "@/ui/components/NativeHeader";
import { useAccountStore } from "@/stores/account";
import { useSettingsStore } from "@/stores/settings";
import { AppColors, Colors } from "@/utils/colors";
import ActivityIndicator from "@/components/ActivityIndicator";

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
    const scrollViewRef = useRef<ScrollView>(null);

    // Récupérer l'utilisateur actuel pour détecter les messages sortants
    const { accounts, lastUsedAccount } = useAccountStore();
    const currentAccount = accounts.find(a => a.id === lastUsedAccount);
    const currentUserName = currentAccount ? `${currentAccount.firstName} ${currentAccount.lastName}`.trim() : "";
    // La photo de profil est stockée en base64, on la convertit en URI data
    const profilePictureBase64 = currentAccount?.customisation?.profilePicture;
    const currentUserAvatar = profilePictureBase64
        ? (profilePictureBase64.startsWith("data:") ? profilePictureBase64 : `data:image/jpeg;base64,${profilePictureBase64}`)
        : undefined;

    // Récupérer la couleur d'accentuation choisie par l'utilisateur
    const { personalization } = useSettingsStore();
    const colorSelected = personalization.colorSelected ?? Colors.PINK;
    const themeColor = AppColors.find(c => c.colorEnum === colorSelected)?.mainColor || "#DD007D";

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

    // Scroll vers le bas quand les messages sont chargés
    useEffect(() => {
        if (messages.length > 0) {
            setTimeout(() => {
                scrollViewRef.current?.scrollToEnd({ animated: false });
            }, 100);
        }
    }, [messages]);

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
                    ref={scrollViewRef}
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

                    {/* Loader pendant le chargement */}
                    {loading && messages.length === 0 && (
                        <View style={{ alignItems: "center", paddingVertical: 40 }}>
                            <ActivityIndicator size={32} color={themeColor} />
                        </View>
                    )}

                    {/* Messages triés du plus ancien au plus récent */}
                    {[...messages].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((m) => {
                        // Détection des messages sortants (de l'utilisateur qui regarde l'écran)
                        // Si createdByAccount = true, l'utilisateur est le créateur, donc ses messages = author === creator
                        // Si createdByAccount = false, l'utilisateur n'est pas le créateur, donc ses messages = author !== creator
                        const isOutgoing = !(chatParams.createdByAccount
                            ? m.author === chatParams.creator
                            : m.author !== chatParams.creator);

                        const cleaned = decodeHtmlEntities(stripHtmlTags(m.content));
                        const msgProfileColor = getProfileColorByName(m.author);

                        return (
                            <View key={m.id} style={{ marginVertical: 4 }}>
                                <View
                                    style={{
                                        flexDirection: "row",
                                        justifyContent: isOutgoing ? "flex-end" : "flex-start",
                                        alignItems: "flex-end",
                                        paddingHorizontal: 4,
                                    }}
                                >
                                    {/* Avatar à gauche pour les messages reçus */}
                                    {!isOutgoing && (
                                        <Avatar
                                            size={32}
                                            color={msgProfileColor}
                                            initials={getInitials(m.author)}
                                            style={{ marginRight: 8 }}
                                        />
                                    )}
                                    <View style={{ maxWidth: "70%" }}>
                                        {/* Nom de l'auteur au-dessus de la bulle */}
                                        <Typography weight="semibold" variant="caption" color="secondary" style={{ marginBottom: 4, textAlign: isOutgoing ? "right" : "left", marginHorizontal: 4 }}>
                                            {isOutgoing ? t("Chat_Me") : m.author}
                                        </Typography>
                                        <View
                                            style={{
                                                backgroundColor: isOutgoing ? themeColor : colors.text + "12",
                                                paddingVertical: 10,
                                                paddingHorizontal: 14,
                                                borderRadius: 20,
                                                borderBottomRightRadius: isOutgoing ? 6 : 20,
                                                borderBottomLeftRadius: isOutgoing ? 20 : 6,
                                                // Ombre légère pour les messages de l'utilisateur
                                                ...(isOutgoing && {
                                                    shadowColor: themeColor,
                                                    shadowOffset: { width: 0, height: 2 },
                                                    shadowOpacity: 0.25,
                                                    shadowRadius: 6,
                                                    elevation: 3,
                                                }),
                                            }}
                                        >
                                            <Typography color={isOutgoing ? "#FFFFFF" : undefined}>
                                                {cleaned}
                                            </Typography>
                                            <Typography color={isOutgoing ? "#FFFFFF99" : "secondary"} variant="caption" style={{ marginTop: 4, textAlign: isOutgoing ? "right" : "left" }}>
                                                {new Date(m.date).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                                            </Typography>
                                        </View>
                                    </View>
                                    {/* Avatar à droite pour les messages de l'utilisateur */}
                                    {isOutgoing && (
                                        <Avatar
                                            size={32}
                                            color={themeColor}
                                            initials={getInitials(currentUserName || m.author)}
                                            imageUrl={currentUserAvatar}
                                            style={{ marginLeft: 8 }}
                                        />
                                    )}
                                </View>

                                {/* Pièces jointes en dessous de la bulle */}
                                {m.attachments && m.attachments.length > 0 && (
                                    <View style={{
                                        marginTop: 6,
                                        marginLeft: isOutgoing ? 0 : 44,
                                        marginRight: isOutgoing ? 44 : 0,
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

