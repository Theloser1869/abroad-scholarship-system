"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { authErrorMessage } from "@/lib/auth/auth-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

type Step = "credentials" | "mfa";

/// Login UI (F02 instruction §18/§19) mapped exactly to the real backend contract
/// (POST /auth/login → either full tokens or `{ mfaRequired, mfaToken }`;
/// POST /auth/mfa/login-verify to complete the second factor) — see
/// docs/frontend/FRONTEND_AUTH.md "Login + MFA flow". Password is never logged (no
/// `console.log` anywhere on this path) and is cleared from local state the moment it's been
/// sent, whether the attempt succeeds or fails.
export function LoginForm() {
  const { login, mfaVerify, principal } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState<Step>("credentials");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function redirectAfter(roleCode: string) {
    const next = searchParams.get("next");
    if (next && next.startsWith("/")) {
      router.replace(next);
      return;
    }
    router.replace(roleCode === "STUDENT_PARENT" ? "/portal" : "/dashboard");
  }

  async function handleCredentialsSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const outcome = await login(username, password);
      setPassword("");
      if (outcome.mfaRequired && outcome.mfaToken) {
        setMfaToken(outcome.mfaToken);
        setStep("mfa");
        return;
      }
      if (outcome.principal) {
        redirectAfter(outcome.principal.roleCode);
      }
    } catch (err) {
      setPassword("");
      setErrorMessage(authErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMfaSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mfaToken) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const result = await mfaVerify(mfaToken, code);
      redirectAfter(result.roleCode);
    } catch (err) {
      setCode("");
      setErrorMessage(authErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  // Already authenticated (e.g. navigated back to /login manually) — leave immediately
  // rather than showing the form again. A side-effecting navigation belongs in an effect,
  // never directly in the render body.
  useEffect(() => {
    if (principal) {
      redirectAfter(principal.roleCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [principal]);

  if (principal) {
    return null;
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{step === "credentials" ? "Đăng nhập" : "Xác thực hai lớp"}</CardTitle>
      </CardHeader>

      {step === "credentials" ? (
        <form onSubmit={handleCredentialsSubmit} className="flex flex-col gap-3">
          <div>
            <label htmlFor="username" className="mb-1 block text-sm font-medium">
              Tên đăng nhập
            </label>
            <Input
              id="username"
              name="username"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium">
              Mật khẩu
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
            />
          </div>
          {errorMessage ? (
            <p role="alert" className="text-sm text-danger">
              {errorMessage}
            </p>
          ) : null}
          <Button type="submit" disabled={submitting}>
            {submitting ? "Đang đăng nhập..." : "Đăng nhập"}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleMfaSubmit} className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Nhập mã xác thực từ ứng dụng authenticator, hoặc một mã dự phòng.
          </p>
          <div>
            <label htmlFor="mfa-code" className="mb-1 block text-sm font-medium">
              Mã xác thực
            </label>
            <Input
              id="mfa-code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={submitting}
            />
          </div>
          {errorMessage ? (
            <p role="alert" className="text-sm text-danger">
              {errorMessage}
            </p>
          ) : null}
          <Button type="submit" disabled={submitting}>
            {submitting ? "Đang xác thực..." : "Xác thực"}
          </Button>
          <button
            type="button"
            onClick={() => {
              setStep("credentials");
              setMfaToken(null);
              setCode("");
              setErrorMessage(null);
            }}
            className="text-sm text-muted-foreground underline underline-offset-4"
          >
            Quay lại đăng nhập
          </button>
        </form>
      )}
    </Card>
  );
}
