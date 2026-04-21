import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import {
  ONBOARDING_STEPS,
  ONBOARDING_VERSION,
  OnboardingState,
  OnboardingStep,
  OnboardingTab,
  readOnboardingCache,
  writeOnboardingCache,
} from "@/lib/onboarding";

const TARGET_WAIT_MAX_ATTEMPTS = 20;
const TARGET_WAIT_INTERVAL_MS = 120;

export function useOnboardingTour({
  userId,
  activeTab,
  mountedTab,
  setActiveTab,
}: {
  userId?: string;
  activeTab: string;
  mountedTab: string;
  setActiveTab: (tab: string) => void;
}) {
  const [isLoadingState, setIsLoadingState] = useState(true);
  const [isWelcomeOpen, setIsWelcomeOpen] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [targetVisible, setTargetVisible] = useState(false);

  const currentStep = useMemo<OnboardingStep | null>(() => ONBOARDING_STEPS[stepIndex] ?? null, [stepIndex]);

  const syncState = useCallback(async (status: "not_started" | "skipped" | "completed") => {
    const payload = { status, onboardingVersion: ONBOARDING_VERSION };
    writeOnboardingCache(payload);
    await apiRequest("PATCH", "/api/onboarding", payload);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setIsLoadingState(false);
      return;
    }

    (async () => {
      try {
        const cached = readOnboardingCache();
        if (
          cached &&
          cached.onboardingVersion === ONBOARDING_VERSION &&
          (cached.status === "completed" || cached.status === "skipped")
        ) {
          if (!cancelled) {
            setIsWelcomeOpen(false);
            setIsLoadingState(false);
          }
          return;
        }

        const res = await apiRequest("GET", "/api/onboarding");
        const remote = (await res.json()) as OnboardingState;
        const normalized: OnboardingState = {
          status: remote.status ?? "not_started",
          onboardingVersion: remote.onboardingVersion ?? ONBOARDING_VERSION,
          completedAt: remote.completedAt ?? null,
          skippedAt: remote.skippedAt ?? null,
        };
        writeOnboardingCache(normalized);

        if (!cancelled) {
          const doneForCurrentVersion =
            normalized.onboardingVersion >= ONBOARDING_VERSION &&
            (normalized.status === "completed" || normalized.status === "skipped");
          setIsWelcomeOpen(!doneForCurrentVersion);
        }
      } catch {
        if (!cancelled) {
          setIsWelcomeOpen(true);
        }
      } finally {
        if (!cancelled) setIsLoadingState(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const recalcRect = useCallback((testId: string) => {
    const target = document.querySelector(`[data-testid="${testId}"]`) as HTMLElement | null;
    if (!target) {
      setTargetRect(null);
      setTargetVisible(false);
      return false;
    }
    target.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    setTargetRect(target.getBoundingClientRect());
    setTargetVisible(true);
    return true;
  }, []);

  useEffect(() => {
    if (!isTourOpen || !currentStep) return;
    let cancelled = false;
    let attempts = 0;

    const tryFind = () => {
      if (cancelled) return;
      attempts += 1;
      const found = recalcRect(currentStep.targetTestId);
      if (found || attempts >= TARGET_WAIT_MAX_ATTEMPTS) return;
      window.setTimeout(tryFind, TARGET_WAIT_INTERVAL_MS);
    };

    tryFind();
    const onResize = () => recalcRect(currentStep.targetTestId);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [isTourOpen, currentStep, recalcRect, activeTab, mountedTab]);

  const goToStep = useCallback(
    (index: number) => {
      const next = ONBOARDING_STEPS[index];
      if (!next) return;
      setStepIndex(index);
      setTargetVisible(false);
      setTargetRect(null);
      setActiveTab(next.tab as OnboardingTab);
    },
    [setActiveTab],
  );

  const start = useCallback(() => {
    setIsWelcomeOpen(false);
    setIsTourOpen(true);
    goToStep(0);
  }, [goToStep]);

  const replay = useCallback(async () => {
    setIsWelcomeOpen(false);
    setIsTourOpen(true);
    goToStep(0);
    try {
      await syncState("not_started");
    } catch {
      // non-fatal
    }
  }, [goToStep, syncState]);

  const next = useCallback(async () => {
    if (stepIndex >= ONBOARDING_STEPS.length - 1) {
      setIsTourOpen(false);
      setIsWelcomeOpen(false);
      await syncState("completed");
      return;
    }
    goToStep(stepIndex + 1);
  }, [goToStep, stepIndex, syncState]);

  const back = useCallback(() => {
    if (stepIndex <= 0) return;
    goToStep(stepIndex - 1);
  }, [goToStep, stepIndex]);

  const skip = useCallback(async () => {
    setIsTourOpen(false);
    setIsWelcomeOpen(false);
    await syncState("skipped");
  }, [syncState]);

  return {
    isLoadingState,
    isWelcomeOpen,
    isTourOpen,
    stepIndex,
    steps: ONBOARDING_STEPS,
    currentStep,
    targetRect,
    targetVisible,
    setIsWelcomeOpen,
    start,
    replay,
    next,
    back,
    skip,
    onboardingActive: isWelcomeOpen || isTourOpen,
  };
}
