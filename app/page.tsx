import { getScheduleData } from "@/lib/parseSchedule";
import Dashboard from "@/components/Dashboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  try {
    const { weeks, siteColors, specialties } = await getScheduleData();
    return (
      <Dashboard
        weeks={weeks}
        siteColors={siteColors}
        specialties={specialties}
        generatedAt={new Date().toISOString()}
        error={null}
      />
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido al leer el archivo.";
    return <Dashboard weeks={[]} siteColors={{}} specialties={{}} generatedAt={new Date().toISOString()} error={message} />;
  }
}
