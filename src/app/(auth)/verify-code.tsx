import { Redirect, useLocalSearchParams } from "expo-router";

import { AuthScreen } from "@/components/login/auth-screen";
import { VerifyCodeForm } from "@/components/login/verify-code-form";

/** Step 2 of email sign-in. Needs `?email=` (pushed by the sign-in form). */
export default function VerifyCodeScreen() {
  const { email } = useLocalSearchParams<{ email?: string }>();
  if (!email) return <Redirect href="/sign-in" />;

  return (
    <AuthScreen title="Check your inbox" subtitle="One code, one tap, and you're back in your queue.">
      <VerifyCodeForm email={email} />
    </AuthScreen>
  );
}
