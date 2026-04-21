import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { OnboardingStep } from "@/lib/onboarding";

interface OnboardingTourProps {
  isWelcomeOpen: boolean;
  isTourOpen: boolean;
  currentStep: OnboardingStep | null;
  stepIndex: number;
  totalSteps: number;
  targetRect: DOMRect | null;
  targetVisible: boolean;
  onStart: () => void;
  onSkip: () => void;
  onBack: () => void;
  onNext: () => void;
}

export default function OnboardingTour({
  isWelcomeOpen,
  isTourOpen,
  currentStep,
  stepIndex,
  totalSteps,
  targetRect,
  targetVisible,
  onStart,
  onSkip,
  onBack,
  onNext,
}: OnboardingTourProps) {
  const isLastStep = stepIndex >= totalSteps - 1;
  const tooltipTop = targetRect ? Math.min(targetRect.bottom + 12, window.innerHeight - 220) : 100;
  const tooltipLeft = targetRect ? Math.max(16, Math.min(targetRect.left, window.innerWidth - 360)) : 16;

  return (
    <>
      <Dialog open={isWelcomeOpen}>
        <DialogContent className="max-w-md" data-testid="dialog-onboarding-welcome">
          <DialogHeader>
            <DialogTitle>Welcome to AniCircle</DialogTitle>
            <DialogDescription>
              Want a quick 2-minute guide? We will walk you through each feature tab so you can use the full app fast.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={onSkip} data-testid="button-onboarding-skip-welcome">
              Skip
            </Button>
            <Button onClick={onStart} data-testid="button-onboarding-start">
              Start Guide
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isTourOpen && currentStep && (
        <div className="fixed inset-0 z-[120] pointer-events-none" aria-hidden="true">
          <div className="absolute inset-0 bg-black/55" />

          {targetRect && (
            <div
              className="absolute rounded-xl border-2 border-primary shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] transition-all duration-200"
              style={{
                left: targetRect.left - 6,
                top: targetRect.top - 6,
                width: targetRect.width + 12,
                height: targetRect.height + 12,
              }}
            />
          )}

          <div
            className="absolute pointer-events-auto w-[min(360px,calc(100vw-2rem))] rounded-xl border border-primary/40 bg-card/95 p-4 shadow-2xl backdrop-blur"
            style={{ top: tooltipTop, left: tooltipLeft }}
            data-testid="panel-onboarding-step"
          >
            <p className="text-[10px] tracking-[0.18em] uppercase text-muted-foreground mb-2">
              Step {stepIndex + 1} of {totalSteps}
            </p>
            <h3 className="text-base font-semibold mb-1">{currentStep.title}</h3>
            <p className="text-sm text-muted-foreground mb-3">{currentStep.description}</p>
            {!targetVisible && (
              <p className="text-xs text-amber-300 mb-3">Loading this section...</p>
            )}

            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 px-3"
                onClick={onSkip}
                data-testid="button-onboarding-skip"
              >
                Skip tour
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 px-3"
                  onClick={onBack}
                  disabled={stepIndex === 0}
                  data-testid="button-onboarding-back"
                >
                  Back
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 px-3"
                  onClick={onNext}
                  data-testid="button-onboarding-next"
                >
                  {isLastStep ? "Finish" : "Next"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
