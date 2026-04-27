"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

function normalizeRedirectPath(pathname: FormDataEntryValue | null) {
  if (typeof pathname !== "string" || !pathname.startsWith("/") || pathname.startsWith("/auth")) {
    return "/admin";
  }

  return pathname;
}

function buildLoginRedirect(redirectTo: string, errorCode: string) {
  const searchParams = new URLSearchParams({ error: errorCode });

  if (redirectTo !== "/admin") {
    searchParams.set("next", redirectTo);
  }

  return `/auth/login?${searchParams.toString()}`;
}

export async function loginWithPasswordAction(formData: FormData) {
  const redirectTo = normalizeRedirectPath(formData.get("redirectTo"));
  const email = formData.get("email");
  const password = formData.get("password");

  if (typeof email !== "string" || typeof password !== "string") {
    redirect(buildLoginRedirect(redirectTo, "login_failed"));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(buildLoginRedirect(redirectTo, "invalid_credentials"));
  }

  redirect(redirectTo);
}