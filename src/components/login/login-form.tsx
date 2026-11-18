import { zodResolver } from "@hookform/resolvers/zod";
import * as AppleAuthentication from "expo-apple-authentication";
import { router } from "expo-router";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { Platform, Text, View } from "react-native";

import { describeAuthError, useAppleSignIn, useSendEmailCode, useSocialSignIn } from "@/api/auth.api";
import { GitHubLogo, GoogleLogo } from "@/components/brand/provider-logos";
import { AuthButton } from "@/components/login/auth-button";
import { AuthField } from "@/components/login/auth-field";
import { AUTH, AUTH_FONT } from "@/components/login/auth-palette";
import { ErrorNote } from "@/components/login/error-note";
import { FadeIn } from "@/components/login/fade-in";
import { ArrowRight, Mail } from "@/lib/icons";
import { emailSchema } from "@/schemas/auth.schema";
import type { EmailInput, EmailValues, SocialProvider } from "@/types/auth.types";

/** Sign in with Apple exists only on iOS (13+). Android / web never show the button. */
function useAppleAvailable() {
  const [available, setAvailable] = React.useState(false);
  React.useEffect(() => {
    if (Platform.OS !== "ios") return;
    let alive = true;
    AppleAuthentication.isAvailableAsync()
      .then((ok) => alive && setAvailable(ok))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return available;
}

/**
 * Sign-in: Apple (iOS), then the web's two providers (Google, GitHub) first — that's how existing
 * Ninja Loop users already sign in — then an email one-time code for everyone else
 * (and for App Review). On success the session provider refetches and
 * Stack.Protected moves to (app); no manual navigation.
 */
export function LoginForm() {
  const social = useSocialSignIn();
  const apple = useAppleSignIn();
  const sendCode = useSendEmailCode();
  const appleAvailable = useAppleAvailable();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<EmailInput, unknown, EmailValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });

  const busy = social.isPending || apple.isPending || sendCode.isPending;
  const pendingProvider = social.isPending ? (social.variables as SocialProvider) : null;
  const formError = social.isError
    ? describeAuthError(social.error)
    : apple.isError
      ? describeAuthError(apple.error)
      : sendCode.isError
        ? describeAuthError(sendCode.error)
        : null;

  const clearErrors = () => {
    if (social.isError) social.reset();
    if (apple.isError) apple.reset();
    if (sendCode.isError) sendCode.reset();
  };

  const signInWithApple = () => {
    if (busy) return;
    clearErrors();
    apple.mutate();
  };

  const signInWith = (provider: SocialProvider) => {
    if (busy) return;
    clearErrors();
    social.mutate(provider);
  };

  const onSubmitEmail = handleSubmit(({ email }) => {
    if (busy) return;
    clearErrors();
    sendCode.mutate(email, {
      onSuccess: () => router.push({ pathname: "/verify-code", params: { email } }),
    });
  });

  return (
    <View style={{ gap: 24 }}>
      <FadeIn delay={200}>
        <View style={{ gap: 8 }}>
          <Text
            style={{ fontFamily: AUTH_FONT.extrabold, fontSize: 24, lineHeight: 30, letterSpacing: -0.6, color: AUTH.ink }}
          >
            Welcome back
          </Text>
          <Text style={{ fontFamily: AUTH_FONT.regular, fontSize: 15, lineHeight: 22, color: AUTH.inkSoft }}>
            Sign in with the account you use for Ninja Loop on the web.
          </Text>
        </View>
      </FadeIn>

      <FadeIn delay={250}>
        <View style={{ gap: 12 }}>
          {appleAvailable ? (
            // Apple's own button (HIG / App Review), styled to sit with the other pills.
            <View style={{ opacity: busy && !apple.isPending ? 0.5 : 1 }} pointerEvents={busy ? "none" : "auto"}>
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={27}
                style={{ height: 54, width: "100%" }}
                onPress={signInWithApple}
              />
            </View>
          ) : null}
          <AuthButton
            variant="social"
            label="Continue with Google"
            icon={<GoogleLogo size={20} />}
            loading={pendingProvider === "google"}
            disabled={busy && pendingProvider !== "google"}
            onPress={() => signInWith("google")}
          />
          <AuthButton
            variant="social"
            label="Continue with GitHub"
            icon={<GitHubLogo size={20} color={AUTH.ink} />}
            loading={pendingProvider === "github"}
            disabled={busy && pendingProvider !== "github"}
            onPress={() => signInWith("github")}
          />
        </View>
      </FadeIn>

      <FadeIn delay={300}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: AUTH.line }} />
          <Text
            style={{
              fontFamily: AUTH_FONT.semibold,
              fontSize: 11.5,
              letterSpacing: 1.2,
              color: AUTH.muted,
              textTransform: "uppercase",
            }}
          >
            or with email
          </Text>
          <View style={{ flex: 1, height: 1, backgroundColor: AUTH.line }} />
        </View>
      </FadeIn>

      <FadeIn delay={340}>
        <View style={{ gap: 14 }}>
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <AuthField
                label="Email address"
                icon={Mail}
                placeholder="you@company.com"
                value={value}
                onChangeText={(text) => {
                  clearErrors();
                  onChange(text);
                }}
                onBlur={onBlur}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="send"
                onSubmitEditing={() => void onSubmitEmail()}
                editable={!busy}
                error={errors.email?.message}
              />
            )}
          />

          {formError ? <ErrorNote message={formError} /> : null}

          <AuthButton
            label={sendCode.isPending ? "Sending code…" : "Email me a sign-in code"}
            loading={sendCode.isPending}
            disabled={social.isPending}
            trailing={<ArrowRight size={18} color={AUTH.white} strokeWidth={2.2} />}
            onPress={() => void onSubmitEmail()}
          />
        </View>
      </FadeIn>
    </View>
  );
}
