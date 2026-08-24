"use client";

import { Suspense, use, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { acceptParentInvitation } from "@/lib/portal-access/api";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { crmErrorMessage } from "@/lib/api/error-messages";

/// The one deliberately unauthenticated page in this app (mirrors the backend's own
/// `@Public()` `PublicParentInvitationsController` — the invited parent has no session yet
/// by definition; the raw URL token IS the authorization, F08 instruction §7's "reuse F02
/// AuthProvider" does not apply here since there is no principal to bootstrap yet). Fields
/// are optional client-side because whether they're actually required depends on a
/// server-side lookup (does this email already have a STUDENT_PARENT account?) this page
/// cannot perform in advance — `409 CREDENTIALS_REQUIRED` guides the caller if they left them
/// blank when the backend needed them.
export function AcceptInvitationForm({ token }: { token: string }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const accept = useMutation({
    mutationFn: () => acceptParentInvitation(token, { username: username || undefined, password: password || undefined }),
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await accept.mutateAsync();
      setDone(true);
    } catch {
      // error surfaced below via accept.error
    }
  }

  if (done) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Đã kích hoạt tài khoản</CardTitle>
        </CardHeader>
        <p className="text-sm text-muted-foreground">Bạn có thể đăng nhập ngay bây giờ để vào cổng thông tin.</p>
        <Button className="mt-3" onClick={() => router.push("/login")}>
          Đến trang đăng nhập
        </Button>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Chấp nhận lời mời phụ huynh</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Nếu bạn chưa có tài khoản cổng thông tin, hãy tạo tên đăng nhập và mật khẩu bên dưới. Nếu email này đã có
          tài khoản, bạn có thể để trống.
        </p>
        <div>
          <label htmlFor="invite-username" className="mb-1 block text-sm font-medium">
            Tên đăng nhập (tùy chọn)
          </label>
          <Input id="invite-username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
        </div>
        <div>
          <label htmlFor="invite-password" className="mb-1 block text-sm font-medium">
            Mật khẩu (tùy chọn)
          </label>
          <Input
            id="invite-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        {accept.error ? (
          <p role="alert" className="text-sm text-danger">
            {crmErrorMessage(accept.error)}
          </p>
        ) : null}
        <Button type="submit" disabled={accept.isPending}>
          {accept.isPending ? "Đang xử lý..." : "Chấp nhận lời mời"}
        </Button>
      </form>
    </Card>
  );
}

export default function AcceptInvitationPage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <Suspense fallback={null}>
      <AcceptInvitationPageInner params={params} />
    </Suspense>
  );
}

function AcceptInvitationPageInner({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  return <AcceptInvitationForm token={token} />;
}
