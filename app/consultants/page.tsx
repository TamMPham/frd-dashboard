import { redirect } from "next/navigation";

import Consultants from "@/components/consultants";
import { DEV_AUTH_BYPASS, SUPABASE_CONFIGURED } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Consultants | Donna",
};

export default async function ConsultantsPage() {
  if (DEV_AUTH_BYPASS) {
    return <Consultants />;
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
  return <Consultants />;
}
