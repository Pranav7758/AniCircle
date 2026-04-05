import { useEffect, useState } from "react";
import { getNotifications } from "@/services/supabaseData";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight, PlayCircle, Sparkles, X, CheckCheck } from "lucide-react";

interface Notification {
    id: string;
    animeTitle: string;
    seasonNumber: number | null;
    episodeNumber: number | null;
    notificationType: string;
    message: string;
    read: boolean;
    createdAt: string;
}

export default function NewEpisodesBanner({ userId }: { userId: string }) {
    const [newReleases, setNewReleases] = useState<Notification[]>([]);

    useEffect(() => {
        if (!userId) return;

        const fetchLatest = async () => {
            try {
                const notifications = await getNotifications();
                const recent = notifications?.filter(
                    (n: Notification) => !n.read &&
                        (n.notificationType === "episode_release" || n.notificationType === "season_release")
                ) || [];
                setNewReleases(recent.slice(0, 5));
            } catch (err) {
                console.error("Failed to load new episodes banner", err);
            }
        };

        fetchLatest();
    }, [userId]);

    const dismissOne = async (id: string) => {
        try {
            await apiRequest("PATCH", `/api/notifications/${id}/read`, {});
            setNewReleases(prev => prev.filter(n => n.id !== id));
        } catch {}
    };

    const dismissAll = async () => {
        try {
            await apiRequest("POST", "/api/notifications/read-all", {});
            setNewReleases([]);
        } catch {}
    };

    if (newReleases.length === 0) return null;

    return (
        <Card className="mb-8 border-primary/20 bg-gradient-to-r from-background to-primary/5 shadow-md">
            <CardHeader className="pb-3">
                <CardTitle className="text-xl flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Fresh Drops & New Seasons
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={dismissAll}
                        className="ml-auto text-xs text-muted-foreground gap-1.5 h-7"
                        data-testid="button-dismiss-all-notifications"
                    >
                        <CheckCheck className="h-3.5 w-3.5" />
                        Clear all
                    </Button>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {newReleases.map((item) => (
                        <div
                            key={item.id}
                            className="flex items-center justify-between p-3 rounded-lg bg-card border shadow-sm hover:shadow-md transition-shadow"
                        >
                            <div className="flex items-start gap-3 overflow-hidden">
                                <div className="mt-1 bg-primary/10 p-2 rounded-full text-primary">
                                    <PlayCircle className="h-4 w-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h4 className="font-semibold text-sm truncate" title={item.animeTitle}>
                                        {item.animeTitle}
                                    </h4>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Badge variant={item.notificationType === "season_release" ? "default" : "secondary"} className="text-[10px] px-1.5 py-0 h-4">
                                            {item.notificationType === "season_release" ? "New Season" : `Ep ${item.episodeNumber}`}
                                        </Badge>
                                        <span className="text-xs text-muted-foreground truncate">
                                            {item.seasonNumber ? `Season ${item.seasonNumber}` : "Latest"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="shrink-0 h-8 w-8 rounded-full"
                                onClick={() => dismissOne(item.id)}
                                data-testid={`button-dismiss-notification-${item.id}`}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
