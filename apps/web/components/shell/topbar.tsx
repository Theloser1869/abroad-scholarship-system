import { NotificationBell } from "./notification-bell";
import { UserMenu } from "./user-menu";

export function Topbar() {
  return (
    <header className="flex items-center justify-between border-b border-border px-6 py-3">
      <span className="font-semibold">Hệ thống Quản lý Du học &amp; Học bổng</span>
      <div className="flex items-center gap-2">
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  );
}
