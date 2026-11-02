"use client";
export default function LogoutButton() {
  return (
    <button
      className="linkbtn"
      onClick={async () => {
        await fetch("/api/logout", { method: "POST" });
        location.href = "/login";
      }}
    >
      ออกจากระบบ
    </button>
  );
}
