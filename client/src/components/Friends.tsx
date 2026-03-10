import { useState, useEffect } from "react";
import { getFriends, getFriendRequests, getFriendAnimeList, sendFriendRequest, updateFriendStatus, getProfileByShortId } from "@/services/supabaseData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Check, X, Users, UserSearch, Search, Copy } from "lucide-react";
import { toast } from "sonner";
import AnimeGroupCard from "./AnimeGroupCard";
import { useAuth } from "@/hooks/use-auth";

interface Friend {
  id: string;
  userId: string;
  friendId: string;
  status: string;
  friendName?: string;
}

interface FriendsProps {
  currentUserId: string;
}

interface Anime {
  id: string;
  title: string;
  episodesWatched: number;
  totalEpisodes: number | null;
  status: string;
  rating: number | null;
  notes: string | null;
  coverImage: string | null;
  seasonNumber: number;
  malId: number | null;
  ranking: number | null;
  isHentai: boolean | null;
}

const Friends = ({ currentUserId }: FriendsProps) => {
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Friend[]>([]);
  const [searchShortId, setSearchShortId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const [friendAnimeList, setFriendAnimeList] = useState<Anime[]>([]);
  const [filteredFriendAnimeList, setFilteredFriendAnimeList] = useState<Anime[]>([]);
  const [selectedFriendForList, setSelectedFriendForList] = useState<string>("");
  const [friendSearchQuery, setFriendSearchQuery] = useState("");
  const [friendStatusFilter, setFriendStatusFilter] = useState<string>("all");
  const [friendHentaiFilter, setFriendHentaiFilter] = useState<string>("show");
  const [friendRankingFilter, setFriendRankingFilter] = useState<string>("all");

  const fetchFriendsData = async () => {
    try {
      const data = await getFriends();
      setFriends(data || []);
    } catch (error) {
      console.error("Error fetching friends:", error);
      toast.error("Failed to load friends");
    }
  };

  const fetchFriendRequestsData = async () => {
    try {
      const data = await getFriendRequests();
      setPendingRequests(data || []);
    } catch (error) {
      console.error("Error fetching friend requests:", error);
    }
  };

  const fetchFriendAnimeListData = async (friendId: string) => {
    try {
      const data = await getFriendAnimeList(friendId);
      setFriendAnimeList(data || []);
    } catch (error) {
      console.error("Error fetching friend's anime list:", error);
      toast.error("Failed to load friend's anime list");
      setFriendAnimeList([]);
    }
  };

  useEffect(() => {
    fetchFriendsData();
    fetchFriendRequestsData();
  }, [currentUserId]);

  useEffect(() => {
    if (selectedFriendForList) {
      fetchFriendAnimeListData(selectedFriendForList);
    } else {
      setFriendAnimeList([]);
      setFilteredFriendAnimeList([]);
    }
  }, [selectedFriendForList]);

  useEffect(() => {
    let filtered = friendAnimeList;

    if (friendSearchQuery) {
      filtered = filtered.filter((anime) =>
        anime.title.toLowerCase().includes(friendSearchQuery.toLowerCase())
      );
    }

    if (friendStatusFilter !== "all") {
      filtered = filtered.filter((anime) => anime.status === friendStatusFilter);
    }

    if (friendHentaiFilter === "hide") {
      filtered = filtered.filter((anime) => !anime.isHentai);
    } else if (friendHentaiFilter === "only") {
      filtered = filtered.filter((anime) => anime.isHentai === true);
    }

    if (friendRankingFilter === "ranked") {
      filtered = filtered.filter((anime) => anime.ranking !== null);
    } else if (friendRankingFilter === "unranked") {
      filtered = filtered.filter((anime) => anime.ranking === null);
    }

    setFilteredFriendAnimeList(filtered);
  }, [friendAnimeList, friendSearchQuery, friendStatusFilter, friendHentaiFilter, friendRankingFilter]);

  const groupedFriendAnime = filteredFriendAnimeList.reduce((groups, anime) => {
    const title = anime.title;
    if (!groups[title]) {
      groups[title] = [];
    }
    groups[title].push(anime);
    return groups;
  }, {} as Record<string, Anime[]>);

  const handleSendFriendRequest = async () => {
    if (!searchShortId || searchShortId.trim().length !== 5) {
      toast.error("Please enter a valid 5-character User ID");
      return;
    }

    setIsLoading(true);
    try {
      const profile = await getProfileByShortId(searchShortId.toUpperCase().trim());
      if (!profile) {
        toast.error("User not found");
        return;
      }
      await sendFriendRequest(profile.id);
      toast.success("Friend request sent!");
      setSearchShortId("");
      fetchFriendsData();
      fetchFriendRequestsData();
    } catch (error: any) {
      console.error("Error sending friend request:", error);
      toast.error(error.message || "Failed to send friend request");
    } finally {
      setIsLoading(false);
    }
  };

  const acceptFriendRequest = async (requestId: string) => {
    try {
      await updateFriendStatus(requestId, "accepted");
      toast.success("Friend request accepted!");
      fetchFriendsData();
      fetchFriendRequestsData();
    } catch (error) {
      console.error("Error accepting request:", error);
      toast.error("Failed to accept friend request");
    }
  };

  const rejectFriendRequest = async (requestId: string) => {
    try {
      await updateFriendStatus(requestId, "rejected");
      toast.success("Friend request rejected");
      fetchFriendRequestsData();
    } catch (error) {
      console.error("Error rejecting request:", error);
      toast.error("Failed to reject friend request");
    }
  };

  const copyShortId = () => {
    if (user?.shortId) {
      navigator.clipboard.writeText(user.shortId);
      toast.success("Your User ID copied to clipboard!");
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="friends" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="friends" data-testid="tab-my-friends">My Friends</TabsTrigger>
          <TabsTrigger value="requests" data-testid="tab-requests">Requests</TabsTrigger>
          <TabsTrigger value="find" data-testid="tab-find-friends">Find Friends</TabsTrigger>
        </TabsList>

        <TabsContent value="friends" className="space-y-4">
          <div className="space-y-6">
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">View Friend's Anime List</h3>
                <Select value={selectedFriendForList} onValueChange={setSelectedFriendForList}>
                  <SelectTrigger className="w-full md:w-64" data-testid="select-friend">
                    <SelectValue placeholder="Select a friend to view their list" />
                  </SelectTrigger>
                  <SelectContent>
                    {friends.length === 0 ? (
                      <SelectItem value="no-friends" disabled>No friends yet</SelectItem>
                    ) : (
                      friends.map((friend) => {
                        const friendId = friend.userId === currentUserId ? friend.friendId : friend.userId;
                        return (
                          <SelectItem key={friend.id} value={friendId}>
                            {friend.friendName || "Friend"}
                          </SelectItem>
                        );
                      })
                    )}
                  </SelectContent>
                </Select>
              </div>

              {selectedFriendForList && (
                <div className="space-y-4">
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        placeholder="Search anime..."
                        value={friendSearchQuery}
                        onChange={(e) => setFriendSearchQuery(e.target.value)}
                        className="pl-10"
                        data-testid="input-friend-search"
                      />
                    </div>
                    <Select value={friendStatusFilter} onValueChange={setFriendStatusFilter}>
                      <SelectTrigger className="w-full md:w-48">
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="watching">Watching</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="plan_to_watch">Plan to Watch</SelectItem>
                        <SelectItem value="on_hold">On Hold</SelectItem>
                        <SelectItem value="dropped">Dropped</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={friendHentaiFilter} onValueChange={setFriendHentaiFilter}>
                      <SelectTrigger className="w-full md:w-48">
                        <SelectValue placeholder="Hentai filter" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="show">Show All</SelectItem>
                        <SelectItem value="hide">Hide Hentai</SelectItem>
                        <SelectItem value="only">Hentai Only</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={friendRankingFilter} onValueChange={setFriendRankingFilter}>
                      <SelectTrigger className="w-full md:w-48">
                        <SelectValue placeholder="Ranking filter" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Anime</SelectItem>
                        <SelectItem value="ranked">Ranked Only</SelectItem>
                        <SelectItem value="unranked">Unranked Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {filteredFriendAnimeList.length === 0 ? (
                    <div className="text-center py-20 space-y-4">
                      <div className="text-8xl opacity-20">TV</div>
                      <h2 className="text-2xl font-bold text-foreground">No anime found</h2>
                      <p className="text-muted-foreground">
                        {friendSearchQuery || friendStatusFilter !== "all" || friendHentaiFilter !== "show" || friendRankingFilter !== "all"
                          ? "Try adjusting your filters"
                          : "This friend hasn't added any anime yet"}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 animate-fade-in">
                      {Object.entries(groupedFriendAnime).map(([title, seasons]) => (
                        <AnimeGroupCard
                          key={title}
                          title={title}
                          coverImage={seasons[0].coverImage}
                          seasons={seasons.map(s => ({
                            id: s.id,
                            seasonNumber: s.seasonNumber,
                            episodesWatched: s.episodesWatched,
                            totalEpisodes: s.totalEpisodes,
                            status: s.status,
                            rating: s.rating,
                            notes: s.notes || "",
                          }))}
                          onEdit={() => {}}
                          onDelete={() => {}}
                          readOnly
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="mt-6">
                <h3 className="font-semibold mb-4">My Friends</h3>
                {friends.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No friends yet</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {friends.map((friend) => {
                      const friendId = friend.userId === currentUserId ? friend.friendId : friend.userId;
                      return (
                        <Card key={friend.id} className="cursor-pointer hover:bg-accent/50" data-testid={`friend-card-${friend.id}`}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground font-bold">
                                  {friend.friendName?.charAt(0).toUpperCase() || "?"}
                                </div>
                                <div>
                                  <p className="font-semibold">{friend.friendName || "Friend"}</p>
                                </div>
                              </div>
                              <Button variant="outline" onClick={() => setSelectedFriendForList(friendId)} data-testid={`button-view-friend-${friend.id}`}>
                                View List
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="requests" className="space-y-4">
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Pending Requests</h3>
              {pendingRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pending requests</p>
              ) : (
                <div className="space-y-2">
                  {pendingRequests.map((request) => (
                    <Card key={request.id} data-testid={`request-card-${request.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                              <UserPlus className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="font-medium">{request.friendName || "Friend Request"}</p>
                              <p className="text-sm text-muted-foreground">Pending request</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => acceptFriendRequest(request.id)}
                              data-testid={`button-accept-${request.id}`}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => rejectFriendRequest(request.id)}
                              data-testid={`button-reject-${request.id}`}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="find" className="space-y-4">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <h3 className="font-semibold">Your User ID</h3>
                <p className="text-sm text-muted-foreground">
                  Share this ID with friends so they can add you
                </p>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-lg font-mono px-4 py-2">
                    {user?.shortId || "Loading..."}
                  </Badge>
                  <Button variant="outline" size="icon" onClick={copyShortId} data-testid="button-copy-id">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold">Add a Friend</h3>
                <p className="text-sm text-muted-foreground">
                  Enter your friend's 5-character User ID to send them a friend request
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter User ID (e.g., ABC12)"
                    value={searchShortId}
                    onChange={(e) => setSearchShortId(e.target.value.toUpperCase())}
                    maxLength={5}
                    className="font-mono"
                    data-testid="input-friend-id"
                  />
                  <Button
                    onClick={handleSendFriendRequest}
                    disabled={isLoading || searchShortId.length !== 5}
                    data-testid="button-send-request"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Send Request
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Friends;
