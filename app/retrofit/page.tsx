import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { SESSION_COOKIE, isValidSessionValue } from "@/lib/auth";
import { getRetrofitData } from "@/lib/retrofit";
import RetrofitDashboard from "@/components/RetrofitDashboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Retrofit — Pipedrive",
  description: "Pipeline Retrofit: adjudicado, perdido, cartera y conversión, desde Pipedrive",
};

export default async function RetrofitPage() {
  const cookieStore = await cookies();
  if (!isValidSessionValue(cookieStore.get(SESSION_COOKIE)?.value)) {
    redirect("/login?next=/retrofit");
  }

  try {
    const data = await getRetrofitData();
    return <RetrofitDashboard data={data} error={null} />;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido al leer Pipedrive.";
    return <RetrofitDashboard data={null} error={message} />;
  }
}
