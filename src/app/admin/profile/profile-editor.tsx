"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

type ProfileEditorProps = {
  initialDisplayName: string;
  initialAvatarUrl: string;
};

export default function ProfileEditor({
  initialDisplayName,
  initialAvatarUrl,
}: ProfileEditorProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  async function handleProfileSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = createClient();
    setIsSavingProfile(true);
    setProfileError(null);
    setProfileMessage(null);

    try {
      const trimmedName = displayName.trim();
      const trimmedAvatarUrl = avatarUrl.trim();
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: trimmedName,
          display_name: trimmedName,
          avatar_url: trimmedAvatarUrl || null,
        },
      });

      if (error) {
        throw error;
      }

      setProfileMessage("บันทึกข้อมูลโปรไฟล์แล้ว");
      router.refresh();
    } catch (error: unknown) {
      setProfileError(error instanceof Error ? error.message : "บันทึกโปรไฟล์ไม่สำเร็จ");
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handlePasswordSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password.length < 8) {
      setPasswordError("รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัวอักษร");
      setPasswordMessage(null);
      return;
    }

    if (password !== confirmPassword) {
      setPasswordError("รหัสผ่านใหม่และการยืนยันรหัสผ่านต้องตรงกัน");
      setPasswordMessage(null);
      return;
    }

    const supabase = createClient();
    setIsSavingPassword(true);
    setPasswordError(null);
    setPasswordMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        throw error;
      }

      setPassword("");
      setConfirmPassword("");
      setPasswordMessage("อัปเดตรหัสผ่านแล้ว");
    } catch (error: unknown) {
      setPasswordError(error instanceof Error ? error.message : "อัปเดตรหัสผ่านไม่สำเร็จ");
    } finally {
      setIsSavingPassword(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form
        onSubmit={handleProfileSubmit}
        className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
          Edit Profile
        </p>
        <h3 className="mt-2 text-lg font-semibold text-slate-950">แก้ไขชื่อและ avatar</h3>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          ค่านี้จะอัปเดตลงใน Supabase Auth metadata ของบัญชีที่ล็อกอินอยู่ตอนนี้
        </p>

        <div className="mt-5 space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="displayName">Display name</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="ชื่อที่ต้องการแสดงในหลังบ้าน"
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="avatarUrl">Avatar URL</Label>
            <Input
              id="avatarUrl"
              value={avatarUrl}
              onChange={(event) => setAvatarUrl(event.target.value)}
              placeholder="https://..."
            />
          </div>
        </div>

        {profileError ? <p className="mt-4 text-sm text-rose-600">{profileError}</p> : null}
        {profileMessage ? (
          <p className="mt-4 text-sm text-emerald-600">{profileMessage}</p>
        ) : null}

        <div className="mt-5 flex justify-end">
          <Button type="submit" disabled={isSavingProfile}>
            {isSavingProfile ? "กำลังบันทึก..." : "บันทึกโปรไฟล์"}
          </Button>
        </div>
      </form>

      <form
        onSubmit={handlePasswordSubmit}
        className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
          Security
        </p>
        <h3 className="mt-2 text-lg font-semibold text-slate-950">เปลี่ยนรหัสผ่าน</h3>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          ระบบจะอัปเดตรหัสผ่านของผู้ใช้ที่ล็อกอินอยู่ผ่าน Supabase Auth โดยตรง
        </p>

        <div className="mt-5 space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="newPassword">รหัสผ่านใหม่</Label>
            <Input
              id="newPassword"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="อย่างน้อย 8 ตัวอักษร"
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="confirmPassword">ยืนยันรหัสผ่านใหม่</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="พิมพ์ซ้ำอีกครั้ง"
              required
            />
          </div>
        </div>

        {passwordError ? <p className="mt-4 text-sm text-rose-600">{passwordError}</p> : null}
        {passwordMessage ? (
          <p className="mt-4 text-sm text-emerald-600">{passwordMessage}</p>
        ) : null}

        <div className="mt-5 flex justify-end">
          <Button type="submit" disabled={isSavingPassword}>
            {isSavingPassword ? "กำลังอัปเดต..." : "อัปเดตรหัสผ่าน"}
          </Button>
        </div>
      </form>
    </div>
  );
}