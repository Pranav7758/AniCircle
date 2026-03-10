import { useState, useEffect } from "react";
import { getNotifications, markNotificationRead, markAllNotificationsRead } from "@/services/supabaseData";
import { Bell, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { usePushNotifications } from "@/hooks/use-push-notifications";

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

interface NotificationsProps {
  userId: string;
}

const Notifications = ({ userId }: NotificationsProps) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { isSupported, permission, isSubscribed, isSubscribing, subscribe, triggerLocalTestNotification } = usePushNotifications();

  const fetchNotificationsData = async () => {
    if (!userId) return;

    setIsLoading(true);
    try {
      const data = await getNotifications();
      setNotifications(data || []);
      setUnreadCount(data?.filter((n: Notification) => !n.read).length || 0);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const markAllAsReadHandler = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
      toast.success("All notifications marked as read");
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchNotificationsData();
      const interval = setInterval(fetchNotificationsData, 60000);
      return () => clearInterval(interval);
    }
  }, [userId]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" data-testid="button-notifications">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between gap-2 p-4 border-b">
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsReadHandler}
              className="h-7 text-xs"
              data-testid="button-mark-all-read"
            >
              Mark all read
            </Button>
          )}
        </div>

        {isSupported && !isSubscribed && permission !== 'denied' && (
          <div className="bg-primary/10 border-b border-primary/20 p-3 flex flex-col gap-2">
            <p className="text-xs text-primary font-medium flex items-center gap-1">
              <Bell className="w-3 h-3" /> Get instant alerts for new episodes!
            </p>
            <Button
              size="sm"
              variant="default"
              className="w-full text-xs h-7 bg-primary hover:bg-primary/90 shadow-[0_0_10px_rgba(139,92,246,0.5)]"
              onClick={subscribe}
              disabled={isSubscribing}
            >
              {isSubscribing ? "Enabling..." : "Enable Push Notifications"}
            </Button>
          </div>
        )}

        {isSubscribed && (
          <div className="bg-muted/30 border-b border-border/50 p-2 flex justify-between items-center">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Push Enabled</span>
            <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={triggerLocalTestNotification}>Test Alert</Button>
          </div>
        )}

        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No notifications
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-accent/50 transition-colors ${!notification.read ? "bg-accent/30" : ""
                    }`}
                  data-testid={`notification-${notification.id}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{notification.animeTitle}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(notification.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      {!notification.read && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => markAsRead(notification.id)}
                          data-testid={`button-mark-read-${notification.id}`}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default Notifications;
