"use client";
import Icon from "./Icon";

export default function LogoutButton() {
  return (
    <button
      className="btn btn-sm btn-ghost logout rounded-full text-error"
      onClick={async () => {
        await fetch("/api/logout", { method: "POST" });
        location.href = "/login";
      }}
    >
      <Icon name="LogOut" size={16} />
      ออกจากระบบ
    </button>
  );
}
