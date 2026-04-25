import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, LockKeyhole, Shield, Sparkles } from "lucide-react";
import { getServerSession } from "next-auth/next";

import { AuthButtons } from "@/components/auth/auth-buttons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authOptions } from "@/lib/auth";
import { getBackendUser } from "@/lib/backend";

const trustPoints = [
  "Clear permissions and audit access",
  "Sensitive metrics kept in context",
  "Fast sign-in for finance and ops teams",
];

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

const authErrorMessages: Record<string, string> = {
  google: "Google sign-in could not be started. Check the OAuth client configuration and callback URL.",
  "azure-ad": "Microsoft Entra sign-in could not be started. Check the app registration and callback URL.",
  OAuthSignin: "The authentication request failed to start.",
  OAuthCallback: "The provider callback failed.",
  AccessDenied: "Access was denied by the identity provider or application policy.",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await getServerSession(authOptions);
  const params = (await searchParams) ?? {};
  const errorMessage = params.error ? authErrorMessages[params.error] ?? "Authentication could not be completed." : null;

  if (session?.user?.email) {
    const backendUser = await getBackendUser(session.user.email);
    if (backendUser?.is_verified) {
      redirect("/dashboard");
    }

    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.18),transparent_24%),linear-gradient(180deg,#F8FAFC_0%,#EEF2FF_100%)]">
        <div className="solon-shell flex min-h-screen items-center justify-center py-8">
          <Card className="w-full max-w-lg border-white/80 bg-white/92">
            <CardContent className="space-y-5 p-8 text-center">
              <Badge className="mx-auto" variant="muted">
                Pending approval
              </Badge>
              <h1 className="text-3xl font-semibold tracking-tight">Your account is awaiting admin approval.</h1>
              <p className="text-sm leading-6 text-muted-foreground">
                You are authenticated as {session.user.email}, but dashboard access remains disabled until an administrator verifies your account.
              </p>
              {backendUser?.is_admin ? (
                <Button asChild size="lg" className="w-full rounded-2xl">
                  <Link href="/admin/users">Open admin panel</Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.18),transparent_24%),linear-gradient(180deg,#F8FAFC_0%,#EEF2FF_100%)]">
      <div className="solon-shell flex min-h-screen flex-col py-8">
        <div className="mb-10">
          <Button variant="ghost" asChild className="rounded-full px-0 text-muted-foreground">
            <Link href="/">
              <ChevronLeft className="size-4" />
              Back to home
            </Link>
          </Button>
        </div>

        <div className="grid flex-1 items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="max-w-xl">
            <Badge className="mb-6">Secure access</Badge>
            <h1 className="text-5xl leading-tight font-semibold tracking-tight text-balance">
              Enter the workspace where finance becomes decision-ready.
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-8 text-muted-foreground">
              Solon gives leadership teams one clear view of performance, risk, and what needs action next.
            </p>

            <div className="mt-10 space-y-4">
              {trustPoints.map((point, index) => {
                const Icon = [Shield, Sparkles, LockKeyhole][index];

                return (
                  <div
                    key={point}
                    className="flex items-center gap-4 rounded-3xl border border-white/70 bg-white/70 p-4"
                  >
                    <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </div>
                    <p className="text-sm font-medium text-foreground">{point}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <Card className="mx-auto w-full max-w-md border-white/80 bg-white/92">
            <CardHeader className="space-y-3 p-8">
              <Badge variant="muted" className="w-fit">
                Solon account
              </Badge>
              <CardTitle className="text-3xl">Log in</CardTitle>
              <CardDescription className="text-sm leading-6">
                Use your work email to access the Solon dashboard.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 p-8 pt-0">
              {errorMessage ? (
                <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm leading-6 text-destructive">
                  {errorMessage}
                </div>
              ) : null}
              <AuthButtons />
              <p className="text-center text-sm leading-6 text-muted-foreground">
                Access to the dashboard is limited to authenticated users with verified provider profiles.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
