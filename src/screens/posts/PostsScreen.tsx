import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAppStore } from "@/store";
import dayjs from "dayjs";
import { ExternalLink, Search, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function PostsScreen() {
  const { t, posts, setPosts } = useAppStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    setLoading(true);
    try {
      const data = await window.api.getPosts();
      setPosts(data);
    } catch (error: any) {
      toast.error("Lỗi khi tải danh sách bài đăng: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDeleteId) return;
    try {
      await window.api.deletePost(confirmDeleteId);
      toast.success("Đã xoá bài đăng khỏi danh sách");
      loadPosts();
    } catch (error: any) {
      toast.error("Lỗi khi xoá bài đăng: " + error.message);
    } finally {
      setConfirmDeleteId(null);
    }
  };

  const filteredPosts = posts.filter((post) => {
    const matchesSearch =
      post.postUrl.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.contentSnippet.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCampaign = campaignFilter === "" || campaignFilter === "all" || post.campaignId === campaignFilter;
    return matchesSearch && matchesCampaign;
  });

  const uniqueCampaigns = Array.from(new Set(posts.map((p) => p.campaignId))).map((id) => {
    const p = posts.find((post) => post.campaignId === id);
    return { id, name: p?.campaignName || id };
  });

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="gradient-text text-[28px] font-extrabold tracking-tight">{t.posts.title}</h1>
      </div>

      <div className="flex gap-4 p-4">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2" size={18} />
          <Input
            className="pl-10"
            placeholder={t.posts.searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={campaignFilter} onValueChange={(val) => setCampaignFilter(val || "")}>
          <SelectTrigger className="max-w-50">
            <SelectValue placeholder={`${t.posts.filterCampaign}...`} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả</SelectItem>
            {uniqueCampaigns.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center p-8">
          <span className="text-muted-foreground">{t.common.loading}</span>
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-muted-foreground text-[15px]">{t.posts.noPosts}</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredPosts.map((post) => (
            <Card key={post.id}>
              <CardContent className="flex flex-col gap-2 p-4">
                <div className="flex items-start justify-between">
                  <a
                    href={post.postUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary inline-flex items-center gap-1 font-medium hover:underline"
                  >
                    {post.postUrl}
                    <ExternalLink size={14} />
                  </a>
                  <Button
                    size="icon"
                    variant="outline"
                    className="border-destructive/20 bg-destructive/15 text-destructive hover:bg-destructive/25 size-8"
                    onClick={() => setConfirmDeleteId(post.id)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
                <div className="text-muted-foreground flex items-center gap-4 text-sm">
                  <span>
                    <strong>{t.posts.campaign}:</strong> {post.campaignName}
                  </span>
                  <span>
                    <strong>{t.posts.postedAt}:</strong> {dayjs(post.postedAt).format("DD/MM/YYYY HH:mm:ss")}
                  </span>
                  <span>👤 {post.accountId}</span>
                </div>
                <div className="bg-secondary mt-2 rounded-lg p-3 text-sm">
                  <em>{post.contentSnippet}</em>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!confirmDeleteId} onOpenChange={() => setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.common.confirm}</AlertDialogTitle>
            <AlertDialogDescription>{t.posts.confirmDelete}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteConfirm}
            >
              {t.common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
