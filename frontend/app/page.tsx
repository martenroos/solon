import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CirclePlay, ShieldCheck, Sparkles, Waypoints } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const insightCards = [
  {
    title: "Signal over noise",
    body: "Surface the drivers that changed performance, not another wall of charts.",
  },
  {
    title: "Advisor logic",
    body: "Translate cash, margin, and runway into plain-language recommendations.",
  },
  {
    title: "Calm execution",
    body: "Review what matters this week with clear priorities and no dashboard clutter.",
  },
];

const metrics = [
  { label: "Coverage", value: "24 entities", detail: "Grouped into one operating view" },
  { label: "Variance", value: "-3.4%", detail: "Explained by payroll and deferred revenue timing" },
  { label: "Liquidity", value: "14.2 months", detail: "Runway based on current burn and reserve policy" },
];

export default function Home() {
  return (
    <main className="relative overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.20),transparent_32%),radial-gradient(circle_at_80%_20%,rgba(20,184,166,0.15),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.58),rgba(241,245,249,0.22))] dark:bg-[radial-gradient(circle_at_top_left,rgba(96,165,250,0.16),transparent_28%),radial-gradient(circle_at_80%_20%,rgba(45,212,191,0.12),transparent_24%),linear-gradient(180deg,rgba(8,17,32,0.12),rgba(8,17,32,0.38))]" />
      <section className="solon-shell relative flex min-h-screen flex-col">
        <header className="flex items-center justify-between py-8">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/solon-logo.png"
              alt="Solon logo"
              width={48}
              height={48}
              className="size-12 object-contain"
              priority
            />
            <div>
              <p className="text-base font-semibold tracking-[0.18em] text-foreground uppercase">Solon</p>
              <p className="max-w-md text-sm leading-6 text-muted-foreground">
                In all things let reason be your guide.
              </p>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button variant="ghost" asChild className="rounded-full px-5 text-foreground/80">
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild className="rounded-full px-5">
              <Link href="/dashboard">View dashboard</Link>
            </Button>
          </div>
        </header>

        <div className="grid flex-1 items-center gap-14 py-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="max-w-2xl">
            <Badge className="mb-6">See what matters</Badge>
            <div className="mb-8 rounded-[2rem] border border-border/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.9),rgba(232,240,255,0.7))] px-6 py-5 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:bg-[linear-gradient(135deg,rgba(24,32,48,0.92),rgba(22,35,58,0.76))]">
              <p className="text-[10px] font-semibold tracking-[0.24em] text-muted-foreground uppercase">
                Solon Principle
              </p>
              <p className="mt-3 font-heading text-2xl leading-8 text-foreground md:text-3xl md:leading-10">
                In all things let reason be your guide.
              </p>
            </div>
            <h1 className="max-w-4xl text-5xl leading-[1.02] font-semibold tracking-tight text-balance text-foreground md:text-7xl">
              Financial clarity for teams that need answers, not dashboards.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
              Solon interprets your numbers, highlights the drivers behind change,
              and turns financial complexity into clear next decisions led by reason rather than noise.
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Button asChild size="lg" className="rounded-full px-6">
                <Link href="/dashboard">
                  Open product
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-full border-border/70 bg-card/70 px-6"
              >
                <Link href="/login">
                  <CirclePlay className="size-4" />
                  Start with login
                </Link>
              </Button>
            </div>

            <div className="mt-14 grid gap-4 sm:grid-cols-3">
              {metrics.map((metric) => (
                <Card key={metric.label} className="border-border/70 bg-card/75">
                  <CardContent className="space-y-2 p-5">
                    <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
                      {metric.label}
                    </p>
                    <p className="text-2xl font-semibold tracking-tight">{metric.value}</p>
                    <p className="text-sm leading-6 text-muted-foreground">{metric.detail}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <Card className="relative overflow-hidden border-border/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(248,250,252,0.66))] dark:bg-[linear-gradient(180deg,rgba(20,29,45,0.88),rgba(16,24,38,0.72))]">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
            <CardContent className="p-8 md:p-10">
              <div className="flex items-center justify-between border-b border-border/70 pb-6">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Weekly advisor note</p>
                  <h2 className="mt-2 text-3xl font-semibold tracking-tight">Executive summary</h2>
                </div>
                <Badge variant="gold">Curated</Badge>
              </div>

              <div className="mt-8 space-y-5">
                <div className="rounded-3xl bg-[linear-gradient(180deg,rgba(11,18,32,0.96),rgba(23,37,63,0.92))] p-6 text-white shadow-[0_30px_80px_rgba(11,18,32,0.24)]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm text-white/70">Primary insight</p>
                      <p className="mt-3 max-w-sm text-2xl leading-8 font-semibold">
                        Margin compression came from two known inputs, not demand weakness.
                      </p>
                    </div>
                    <Sparkles className="mt-1 size-5 text-[#14B8A6]" />
                  </div>
                  <p className="mt-5 max-w-md text-sm leading-6 text-white/75">
                    Payroll expansion accounted for 61% of the month-over-month delta. A pricing reset
                    in enterprise services explains most of the remainder.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  {insightCards.map((card, index) => {
                    const Icon = [Waypoints, ShieldCheck, Sparkles][index];

                    return (
                      <div
                        key={card.title}
                        className="rounded-3xl border border-border/70 bg-card/70 p-5"
                      >
                        <Icon className="size-5 text-primary" />
                        <h3 className="mt-4 text-base font-semibold">{card.title}</h3>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">{card.body}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
