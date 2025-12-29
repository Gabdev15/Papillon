import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, FlatList } from "react-native";
import Icon from "@/ui/components/Icon";
import Typography from "@/ui/components/Typography";
import Stack from "@/ui/components/Stack";
import Item, { Leading } from "@/ui/components/Item";
import { router, useRouter } from "expo-router";
import { useTheme } from "@react-navigation/native";
import { Papicons } from "@getpapillon/papicons";
import { getManager } from "@/services/shared";
import { Chat } from "@/services/shared/chat";
import { t } from "i18next";
import Avatar from "@/ui/components/Avatar";
import AnimatedPressable from "@/ui/components/AnimatedPressable";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RefreshControl } from "react-native-gesture-handler";
import { Dynamic } from "@/ui/components/Dynamic";
import { PapillonAppearIn, PapillonAppearOut } from "@/ui/utils/Transition";
import { getInitials } from "@/utils/chats/initials";
import { getProfileColorByName } from "@/utils/chats/colors";
import { LayoutAnimationConfig } from "react-native-reanimated";
import { NativeHeaderPressable, NativeHeaderSide, NativeHeaderTitle } from "@/ui/components/NativeHeader";
import TabHeader from "@/ui/components/TabHeader";
import TabHeaderTitle from "@/ui/components/TabHeaderTitle";
import Search from "@/ui/components/Search";

export default function ChatsView() {
    const [chats, setChats] = useState<Chat[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [isManuallyLoading, setIsManuallyLoading] = useState(false);
    const [searchText, setSearchText] = useState("");
    const [headerHeight, setHeaderHeight] = useState(0);
    const [chatPreviews, setChatPreviews] = useState<Record<string, string>>({});

    const theme = useTheme();
    const colors = theme.colors;
    const insets = useSafeAreaInsets();
    const nav = useRouter();

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

    const fetchChatPreview = useCallback(async (chat: Chat) => {
        try {
            const manager = getManager();
            const msgs = await manager.getChatMessages(chat);
            if (msgs && msgs.length > 0) {
                const lastMessage = msgs[msgs.length - 1];
                const cleaned = decodeHtmlEntities(stripHtmlTags(lastMessage.content));
                setChatPreviews(prev => ({ ...prev, [chat.id]: cleaned }));
            }
        } catch {
            // ignore
        }
    }, []);

    const fetchChats = useCallback(async () => {
        const manager = getManager();
        try {
            setLoading(true);
            const fetched = await manager.getChats();
            setChats(fetched ?? []);

            // Récupérer les aperçus pour chaque discussion
            if (fetched) {
                fetched.forEach((chat) => {
                    fetchChatPreview(chat);
                });
            }
        } catch (err) {
            // ignore
        } finally {
            setLoading(false);
            setIsManuallyLoading(false);
        }
    }, [fetchChatPreview]);

    useEffect(() => {
        fetchChats();
    }, []);

    const sortedChats = useMemo(() => {
        return [...chats].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [chats]);

    const filteredChats = useMemo(() => {
        if (!searchText) return sortedChats;
        const search = searchText.toLowerCase();
        return sortedChats.filter((chat) =>
            (chat.subject?.toLowerCase().includes(search)) ||
            (chat.recipient?.toLowerCase().includes(search)) ||
            (chat.creator?.toLowerCase().includes(search))
        );
    }, [sortedChats, searchText]);

    const openChat = (chat: Chat) => {
        // Créer un objet simplifié sans le ref (qui peut contenir des références cycliques)
        const chatData = {
            id: chat.id,
            subject: chat.subject,
            recipient: chat.recipient,
            creator: chat.creator,
            date: chat.date,
            createdByAccount: chat.createdByAccount,
        };
        nav.push({
            pathname: "/(modals)/chat",
            params: { chat: JSON.stringify(chatData) },
        });
    };

    // Vue liste des discussions
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
                <></>
            </NativeHeaderTitle>

            <TabHeader
                onHeightChanged={setHeaderHeight}
                title={
                    <TabHeaderTitle
                        color={colors.primary}
                        leading={t("Chat_Title")}
                        chevron={false}
                        loading={loading}
                    />
                }
                bottom={
                    <Search
                        placeholder={t("Chat_Search_Placeholder")}
                        color={colors.primary}
                        onTextChange={setSearchText}
                    />
                }
            />

            <LayoutAnimationConfig skipEntering>
                <FlatList
                    contentContainerStyle={{
                        paddingBottom: insets.bottom + 16,
                        paddingHorizontal: 16,
                        gap: 9,
                    }}
                    refreshControl={
                        <RefreshControl
                            refreshing={isManuallyLoading}
                            onRefresh={() => {
                                setIsManuallyLoading(true);
                                fetchChats();
                            }}
                            progressViewOffset={headerHeight}
                        />
                    }
                    data={filteredChats}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <ChatItem chat={item} onPress={() => openChat(item)} preview={chatPreviews[item.id]} />
                    )}
                    scrollIndicatorInsets={{ top: headerHeight - insets.top }}
                    ListHeaderComponent={<View style={{ height: headerHeight }} />}
                    ListEmptyComponent={
                        <Dynamic animated key="empty-chats" entering={PapillonAppearIn} exiting={PapillonAppearOut}>
                            <Stack
                                hAlign="center"
                                vAlign="center"
                                flex
                                style={{ width: "100%", marginTop: 16 }}
                            >
                                <Icon opacity={0.5} size={32} style={{ marginBottom: 3 }}>
                                    <Papicons name={searchText ? "Search" : "TextBubble"} />
                                </Icon>
                                <Typography variant="h4" color="text" align="center">
                                    {searchText ? t("Chat_Search_NoResults") : t("Chat_Empty_Title")}
                                </Typography>
                                <Typography variant="body2" color="secondary" align="center">
                                    {searchText
                                        ? t("Chat_Search_NoResults_Description")
                                        : t("Chat_Empty_Description")}
                                </Typography>
                            </Stack>
                        </Dynamic>
                    }
                />
            </LayoutAnimationConfig>
        </>
    );
}

interface ChatItemProps {
    chat: Chat;
    onPress: () => void;
    preview?: string;
}

const ChatItem: React.FC<ChatItemProps> = ({ chat, onPress, preview }) => {
    const profileColor = useMemo(() => getProfileColorByName(chat.creator || chat.recipient || ""), [chat]);
    const profileInitials = useMemo(() => getInitials(chat.creator || chat.recipient || ""), [chat]);

    const truncateString = (str: string, maxLength: number): string => {
        if (str.length <= maxLength) return str;
        return str.slice(0, maxLength) + "...";
    };

    return (
        <AnimatedPressable onPress={onPress}>
            <Stack card>
                <Item isLast>
                    <Leading>
                        <Avatar
                            size={40}
                            color={profileColor}
                            initials={profileInitials}
                        />
                    </Leading>

                    <Typography variant="title" numberOfLines={2}>
                        {chat.subject || chat.recipient || t("Chat_NoTitle")}
                    </Typography>
                    <Typography variant="body1" color="secondary" numberOfLines={3}>
                        {preview ? truncateString(preview, 100) : (chat.creator || "")}
                    </Typography>

                    <Stack
                        direction="horizontal"
                        gap={4}
                        style={{ marginTop: 4 }}
                        hAlign="center"
                    >
                        <Typography nowrap weight="medium" style={{ flex: 1 }} variant="caption" color="secondary">
                            {chat.creator || ""}
                        </Typography>

                        <Typography nowrap weight="medium" variant="caption" color="secondary">
                            {new Date(chat.date).toLocaleDateString(undefined, {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                            })}
                        </Typography>
                    </Stack>
                </Item>
            </Stack>
        </AnimatedPressable>
    );
};
