import { AuthScreen } from "@/components/login/auth-screen";
import { LoginForm } from "@/components/login/login-form";

/** Google / GitHub / email-code sign-in. Thin route: the shell + the form. */
export default function SignInScreen() {
  return (
    <AuthScreen title="Keep the loop moving" subtitle="Your workspaces and priorities, in your pocket. Top of the queue is what's next.">
      <LoginForm />
    </AuthScreen>
  );
}
