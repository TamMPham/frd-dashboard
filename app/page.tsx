import { redirect } from "next/navigation";

import Dashboard from "@/components/dashboard";
import { DEV_AUTH_BYPASS, SUPABASE_CONFIGURED } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  if (DEV_AUTH_BYPASS) {
    return <Dashboard userEmail="" />;
  }
  if (!SUPABASE_CONFIGURED) {
    redirect("/login");
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  return <Dashboard userEmail={user.email ?? ""} />;
}
