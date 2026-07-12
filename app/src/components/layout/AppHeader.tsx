import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Radio } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { fetchMe, logout, type AuthUser } from "@/lib/api";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function AppHeader() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchMe().then((res) => {
      setUser(res.authenticated ? (res.user ?? null) : null);
      setLoading(false);
    });
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <Radio className="size-5 text-primary" />
          <span className="text-lg">fork</span>
        </Link>

        <nav className="flex items-center gap-3">
          <Link
            to="/admin/monitor"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Monitor
          </Link>

          {loading ? (
            <div className="h-8 w-24 animate-pulse rounded-md bg-muted" />
          ) : user ? (
            <div className="flex items-center gap-2">
              <Avatar className="size-8">
                {user.image ? <AvatarImage src={user.image} alt={user.name} /> : null}
                <AvatarFallback className="bg-primary/20 text-xs text-primary">
                  {initials(user.name)}
                </AvatarFallback>
              </Avatar>
              <span className="hidden max-w-[120px] truncate text-sm sm:inline">{user.name}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void logout().then(() => setUser(null))}
              >
                サインアウト
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href="/api/auth/google">Google</a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href="/api/auth/twitter">X</a>
              </Button>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
