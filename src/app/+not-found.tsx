import { Redirect } from "expo-router";

import { useSession } from "@/providers/session-provider";

/**
 * Safety net for any link that doesn't match a reachable screen (an old deep
 * link, a guarded route while signed out, a bare `ninjaloop://`). Never show
 * the "Unmatched route" page — send the user wherever their session belongs.
 */
export default function NotFound() {
  const { data: session } = useSession();
  return <Redirect href={session?.user ? "/" : "/sign-in"} />;
}
