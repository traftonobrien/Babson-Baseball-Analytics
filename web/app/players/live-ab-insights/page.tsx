import { redirect } from "next/navigation";

export const revalidate = 0;

function getParam(
  value: string | string[] | undefined
): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export default async function PlayersLiveAbInsightsPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const nextParams = new URLSearchParams();
  const player = getParam(searchParams.player);
  const result = getParam(searchParams.result);

  if (player) {
    nextParams.set("player", player);
  }
  if (result) {
    nextParams.set("result", result);
  }

  const query = nextParams.toString();
  redirect(query ? `/charting/insights?${query}` : "/charting/insights");
}
