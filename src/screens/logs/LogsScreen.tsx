import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppStore } from "@/store";
import { Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export default function LogsScreen() {
  const { t, logs, clearLogs } = useAppStore();
  const [filter, setFilter] = useState<string>("all");
  const logEndRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll]);

  const filteredLogs = filter === "all" ? logs : logs.filter((l) => l.level === filter);

  const formatTime = (timestamp: string) => new Date(timestamp).toLocaleTimeString();

  const levelIcon = (level: string) => {
    switch (level) {
      case "info": return "ℹ️";
      case "success": return "✅";
      case "warning": return "⚠️";
      case "error": return "❌";
      default: return "📝";
    }
  };

  const levelColor = (level: string) => {
    switch (level) {
      case "info": return "text-info";
      case "success": return "text-success";
      case "warning": return "text-warning";
      case "error": return "text-destructive";
      default: return "text-muted-foreground";
    }
  };

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="gradient-text text-[28px] font-extrabold tracking-tight">{t.logs.title}</h1>
        <Button size="sm" variant="destructive" onClick={clearLogs}>
          <Trash2 size={14} />{t.logs.clear}
        </Button>
      </div>

      <Tabs value={filter} onValueChange={setFilter} className="mb-4">
        <TabsList>
          {["all", "info", "success", "warning", "error"].map((f) => (
            <TabsTrigger key={f} value={f}>
              {f === "all" ? t.logs.all : t.logs[f as keyof typeof t.logs]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="mb-2 flex items-center justify-end gap-2">
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
            className="accent-primary"
          />
          Auto-scroll
        </label>
      </div>

      <Card>
        <CardContent className="p-4">
          <ScrollArea className="h-[500px]">
            <div className="font-mono text-xs">
              {filteredLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-secondary text-xl">📋</div>
                  <p className="text-muted-foreground">{t.logs.noLogs}</p>
                </div>
              ) : (
                <>
                  {[...filteredLogs].reverse().map((log, index) => (
                    <div key={index} className={`mb-1 flex items-start gap-3 rounded-lg px-3 py-1.5 ${levelColor(log.level)}`}>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{formatTime(log.timestamp)}</span>
                      <span>{levelIcon(log.level)}</span>
                      <span className="break-words">{log.message}</span>
                    </div>
                  ))}
                  <div ref={logEndRef} />
                </>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
