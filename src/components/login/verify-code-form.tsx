import { router } from "expo-router";
import * as React from "react";
import { Pressable, Text, View } from "react-native";

import { describeAuthError, useSendEmailCode, useVerifyEmailCode } from "@/api/auth.api";
import { AuthButton } from "@/components/login/auth-button";
import { AUTH, AUTH_FONT } from "@/components/login/auth-palette";
import { ErrorNote } from "@/components/login/error-note";
import { FadeIn } from "@/components/login/fade-in";
import { OtpInput } from "@/components/login/otp-input";
import { ArrowLeft, MailCheck } from "@/lib/icons";
import { OTP_LENGTH, OTP_TTL_MINUTES } from "@/schemas/auth.schema";

/** Seconds before "Resend code" unlocks — keeps people under the server rate limit. */
const RESEND_COOLDOWN = 30;

function goBackToSignIn() {
  if (router.canGoBack()) router.back();
  else router.replace("/sign-in");
}

/** Step 2 of email sign-in: type (or autofill) the 6-digit code from the email. */
export function VerifyCodeForm({ email }: { email: string }) {
  const verify = useVerifyEmailCode();
  const resend = useSendEmailCode();
  const [code, setCode] = React.useState("");
  const [cooldown, setCooldown] = React.useState(RESEND_COOLDOWN);

  // The code was just sent from the previous screen, so start locked.
  React.useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const submitting = verify.isPending;
  const error = verify.isError ? describeAuthError(verify.error) : resend.isError ? describeAuthError(resend.error) : null;

  const submit = (value = code) => {
    if (submitting || value.length !== OTP_LENGTH) return;
    verify.mutate(
      { email, otp: value },
      // A wrong code is cleared so the next attempt starts fresh.
      { onError: () => setCode("") },
    );
  };

  const resendCode = () => {
    if (cooldown > 0 || resend.isPending) return;
    verify.reset();
    setCode("");
    resend.mutate(email, { onSuccess: () => setCooldown(RESEND_COOLDOWN) });
  };

  return (
    <View style={{ gap: 24 }}>
      <FadeIn delay={180}>
        <View style={{ gap: 16 }}>
          {/* Plain style OBJECT, not the function form — see auth-button.tsx. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to sign in"
            onPress={goBackToSignIn}
            hitSlop={12}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: AUTH.line,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ArrowLeft size={18} color={AUTH.inkSoft} strokeWidth={2.2} />
          </Pressable>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                backgroundColor: AUTH.brandSoft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MailCheck size={22} color={AUTH.brand} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: AUTH_FONT.regular, fontSize: 13.5, color: AUTH.muted }}>Code sent to</Text>
              <Text
                selectable
                numberOfLines={1}
                style={{ fontFamily: AUTH_FONT.semibold, fontSize: 16, lineHeight: 22, color: AUTH.ink }}
              >
                {email}
              </Text>
            </View>
          </View>

          <Text style={{ fontFamily: AUTH_FONT.regular, fontSize: 15, lineHeight: 22, color: AUTH.inkSoft }}>
            {`Enter the ${OTP_LENGTH}-digit code from the email. It expires in ${OTP_TTL_MINUTES} minutes — check spam if it isn't there.`}
          </Text>
        </View>
      </FadeIn>

      <FadeIn delay={240}>
        <View style={{ gap: 16 }}>
          <OtpInput
            value={code}
            onChange={(next) => {
              if (verify.isError) verify.reset();
              setCode(next);
            }}
            onComplete={submit}
            length={OTP_LENGTH}
            error={verify.isError}
            editable={!submitting}
            autoFocus
          />

          {error ? <ErrorNote message={error} /> : null}

          <AuthButton
            label={submitting ? "Signing in…" : "Sign in"}
            loading={submitting}
            disabled={code.length !== OTP_LENGTH}
            onPress={() => submit()}
          />

          <AuthButton
            variant="quiet"
            label={
              resend.isPending ? "Sending…" : cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"
            }
            disabled={cooldown > 0 || resend.isPending}
            onPress={resendCode}
          />
        </View>
      </FadeIn>
    </View>
  );
}
