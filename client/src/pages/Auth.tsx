import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Mail, ArrowLeft, KeyRound, Star, Zap, Eye, EyeOff } from "lucide-react";

const Auth = () => {
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading, isRecoveryMode, login, register, resetPassword, verifyRecoveryCode, updatePassword, clearRecoveryMode, loginWithGoogle } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [forgotStep, setForgotStep] = useState<"request" | "verify" | "update" | "success">("request");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    // Prevent redirect while the user is actively in forgot-password flow.
    if (user && !isRecoveryMode && !showForgotPassword) setLocation("/");
  }, [user, setLocation, isRecoveryMode, showForgotPassword]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (!username.trim()) { toast.error("Please enter your username"); setIsLoading(false); return; }
      await register(email, password, username.trim());
      toast.success("Account created! Welcome to AniCircle.");
      setEmail(""); setPassword(""); setUsername("");
    } catch (error: any) {
      toast.error(error.message || "Failed to sign up");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await login(email, password);
      toast.success("Welcome back!");
    } catch (error: any) {
      toast.error(error.message || "Failed to sign in");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      await loginWithGoogle();
    } catch (error: any) {
      toast.error(error.message || "Failed to sign in with Google");
      setIsGoogleLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (!forgotEmail.trim()) { toast.error("Please enter your email"); setIsLoading(false); return; }
      await resetPassword(forgotEmail.trim());
      setForgotStep("verify");
      toast.success("Recovery code sent to your email!");
    } catch (error: any) {
      toast.error(error.message || "Failed to send reset email");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyRecoveryCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (!forgotEmail.trim()) {
        toast.error("Please enter your email");
        setIsLoading(false);
        return;
      }
      if (!recoveryCode.trim()) {
        toast.error("Please enter the recovery code");
        setIsLoading(false);
        return;
      }
      await verifyRecoveryCode(forgotEmail.trim(), recoveryCode.trim());
      setForgotStep("update");
      toast.success("Code verified. Set your new password.");
    } catch (error: any) {
      toast.error(error.message || "Invalid or expired code");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (newPassword.length < 6) { toast.error("Password must be at least 6 characters"); setIsLoading(false); return; }
      if (newPassword !== confirmPassword) { toast.error("Passwords do not match"); setIsLoading(false); return; }
      await updatePassword(newPassword);
      toast.success("Password reset successful!");
      clearRecoveryMode();
      setForgotStep("success");
      setNewPassword(""); setConfirmPassword("");
    } catch (error: any) {
      toast.error(error.message || "Failed to update password");
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-2 border-primary/30 animate-spin-slow" />
            <div className="absolute inset-0 flex items-center justify-center">
              <img src="/logo.png" alt="AniCircle" className="h-10 w-10 rounded-full" />
            </div>
          </div>
          <p className="text-muted-foreground text-sm animate-pulse">Loading AniCircle...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex overflow-hidden bg-background">

      {/* ── Global background treatment ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Subtle grid */}
        <div className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: `repeating-linear-gradient(45deg, hsl(var(--primary) / 0.4) 0 1px, transparent 1px 14px),
                              repeating-linear-gradient(-45deg, hsl(var(--primary) / 0.25) 0 1px, transparent 1px 14px)`,
          }}
        />
        {/* Ambient glow blobs */}
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] orb orb-purple opacity-20" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] orb orb-blue opacity-15" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-[0.04] border border-primary/30" />

        {/* Floating stars */}
        {[
          { size: 2, top: "12%", left: "8%", delay: "0s", dur: "4s" },
          { size: 1.5, top: "28%", left: "22%", delay: "1.2s", dur: "5s" },
          { size: 2.5, top: "65%", left: "5%", delay: "0.6s", dur: "6s" },
          { size: 1, top: "80%", left: "18%", delay: "2s", dur: "4.5s" },
          { size: 2, top: "45%", left: "35%", delay: "1.8s", dur: "5.5s" },
          { size: 1.5, top: "15%", right: "10%", delay: "0.3s", dur: "5s" },
          { size: 2, top: "55%", right: "8%", delay: "1.5s", dur: "4s" },
          { size: 1, top: "75%", right: "25%", delay: "0.9s", dur: "6s" },
          { size: 3, top: "35%", right: "40%", delay: "2.5s", dur: "7s" },
        ].map((s, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-primary/60"
            style={{
              width: `${s.size}px`,
              height: `${s.size}px`,
              top: s.top,
              left: (s as any).left,
              right: (s as any).right,
              animation: `glow-pulse ${s.dur} ease-in-out ${s.delay} infinite, float ${parseFloat(s.dur) + 2}s ease-in-out ${s.delay} infinite`,
              boxShadow: `0 0 ${s.size * 3}px hsl(var(--primary) / 0.8)`,
            }}
          />
        ))}
      </div>

      {/* ── Left panel (desktop only) ── */}
      <div className="hidden lg:flex lg:w-[52%] relative flex-col items-center justify-center p-12 overflow-hidden">

        {/* Left panel ambient bg */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] via-transparent to-violet-900/[0.06]" />
        </div>

        {/* Decorative circles */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] rounded-full border border-primary/8" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[390px] h-[390px] rounded-full border border-primary/12" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[270px] h-[270px] rounded-full border border-primary/22" />
          {/* Orbiting dot */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[390px] h-[390px]">
            <div className="animate-orbit absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary shadow-neon" />
          </div>
          {/* Second orbiting dot, opposite direction */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[270px] h-[270px]" style={{ animation: "orbit 14s linear infinite reverse" }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-violet-400/80" style={{ boxShadow: "0 0 8px hsl(268 88% 62% / 0.6)" }} />
          </div>
        </div>

        {/* Content */}
          <div className="relative z-10 text-center space-y-8 max-w-md deco-card deco-corners p-10" style={{ background: "hsl(0 0% 5% / 0.85)", backdropFilter: "blur(20px)" }}>
          <div className="flex flex-col items-center gap-5">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-primary/30 blur-2xl animate-glow-pulse scale-150" />
              <div className="absolute inset-0 rounded-full bg-violet-500/15 blur-xl animate-float" />
              <img src="/logo.png" alt="AniCircle" className="relative h-28 w-28 rounded-full shadow-neon animate-neon-flicker ring-2 ring-primary/30 ring-offset-2 ring-offset-background" />
            </div>
            <div>
              <h1 className="text-6xl font-black text-gradient mb-3 tracking-wider">AniCircle</h1>
              <div className="deco-divider justify-center mb-2">
                <p className="text-sm text-muted-foreground/80 font-light tracking-[0.2em] uppercase">
                  Your Anime Universe
                </p>
              </div>
            </div>
          </div>

          {/* Feature pills */}
          <div className="flex flex-col gap-2.5">
            {[
              { icon: Eye, label: "Track every episode with real-time progress", color: "text-violet-400", bg: "bg-violet-500/15 border-violet-500/35" },
              { icon: Zap, label: "Radar — never miss a sequel or new season", color: "text-amber-400", bg: "bg-amber-500/15 border-amber-500/35" },
              { icon: Star, label: "Rate and rank your all-time favourites", color: "text-primary", bg: "bg-primary/15 border-primary/35" },
            ].map(({ icon: Icon, label, color, bg }, i) => (
              <div key={label} className="flex items-center gap-3.5 rounded-none px-4 py-3.5 border border-primary/25 bg-card/50 animate-stagger-in group hover:border-primary/50 transition-all duration-200" style={{ animationDelay: `${i * 120 + 200}ms` }}>
                <div className={`shrink-0 w-8 h-8 rounded-none flex items-center justify-center border ${bg}`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <span className="text-sm text-muted-foreground/80 text-left group-hover:text-foreground transition-colors">{label}</span>
              </div>
            ))}
          </div>

          <p className="text-[10px] text-muted-foreground/40 tracking-[0.3em] uppercase">
            ✦ Built for Anime Lovers ✦
          </p>
        </div>
      </div>

      {/* ── Right panel — Form ── */}
      <div className="flex-1 flex items-center justify-center p-4 lg:p-8 relative z-10">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-2">
              <img src="/logo.png" alt="AniCircle" className="h-10 w-10 rounded-full shadow-neon" />
              <h1 className="text-3xl font-black text-gradient">AniCircle</h1>
            </div>
            <p className="text-sm text-muted-foreground">Track Every Episode. Never Miss a Beat.</p>
          </div>

          {/* Card */}
          <div className="deco-card deco-corners p-7 animate-scale-in" style={{ background: "hsl(0 0% 6% / 0.95)", backdropFilter: "blur(24px)", boxShadow: "0 24px 80px -12px hsl(var(--primary) / 0.25), 0 0 0 1px hsl(var(--primary) / 0.08)" }}>

            {isRecoveryMode ? (
              <div className="space-y-5">
                <div className="text-center">
                  <div className="w-14 h-14 bg-primary/15 rounded-none flex items-center justify-center mx-auto mb-4 border border-primary/45">
                    <KeyRound className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold">Set New Password</h3>
                  <p className="text-sm text-muted-foreground mt-1">Enter your new password below</p>
                </div>
                <form onSubmit={handleUpdatePassword} className="space-y-4">
                  <PasswordField
                    label="New Password"
                    id="new-password"
                    value={newPassword}
                    onChange={setNewPassword}
                    disabled={isLoading}
                    showPassword={showNewPassword}
                    onToggleShow={() => setShowNewPassword((v) => !v)}
                  />
                  <PasswordField
                    label="Confirm Password"
                    id="confirm-password"
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    disabled={isLoading}
                    showPassword={showConfirmPassword}
                    onToggleShow={() => setShowConfirmPassword((v) => !v)}
                  />
                  <SubmitButton isLoading={isLoading} loadingText="Updating..." text="Update Password" />
                </form>
                <p className="text-[11px] text-center text-muted-foreground/60">
                  Opened from recovery link. For OTP flow, go back and use "Forgot?" then "I already have a code".
                </p>
              </div>

            ) : showForgotPassword ? (
              <div className="space-y-4">
                <button onClick={() => {
                  setShowForgotPassword(false);
                  setForgotStep("request");
                  setForgotEmail("");
                  setRecoveryCode("");
                  setNewPassword("");
                  setConfirmPassword("");
                }}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2">
                  <ArrowLeft className="h-4 w-4" /> Back to Sign In
                </button>

                {forgotStep === "success" ? (
                  <div className="text-center space-y-4 py-4">
                    <div className="w-14 h-14 bg-primary/15 rounded-none flex items-center justify-center mx-auto border border-primary/45">
                      <Mail className="h-7 w-7 text-primary" />
                    </div>
                    <h3 className="text-xl font-bold">Password Reset Successful</h3>
                    <p className="text-sm text-muted-foreground">
                      Your password has been updated. You can sign in now.
                    </p>
                    <Button variant="outline" onClick={() => {
                      setShowForgotPassword(false);
                      setForgotStep("request");
                      setForgotEmail("");
                      setRecoveryCode("");
                    }} className="w-full rounded-none">
                      Back to Sign In
                    </Button>
                  </div>
                ) : forgotStep === "request" ? (
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <div>
                      <h3 className="text-xl font-bold">Forgot Password?</h3>
                      <p className="text-sm text-muted-foreground mt-1">Enter your email to receive a recovery code</p>
                    </div>
                    <FormField label="Email" id="forgot-email" type="email" value={forgotEmail} onChange={setForgotEmail} disabled={isLoading} placeholder="your@email.com" />
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full rounded-none"
                      onClick={() => setForgotStep("verify")}
                      disabled={isLoading || !forgotEmail.trim()}
                    >
                      I already have a code
                    </Button>
                    <SubmitButton isLoading={isLoading} loadingText="Sending..." text="Send Recovery Code" />
                  </form>
                ) : forgotStep === "verify" ? (
                  <form onSubmit={handleVerifyRecoveryCode} className="space-y-4">
                    <div>
                      <h3 className="text-xl font-bold">Verify Recovery Code</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Enter the code sent to <span className="text-foreground font-medium">{forgotEmail}</span>
                      </p>
                    </div>
                    <FormField label="Recovery Code" id="recovery-code" type="text" value={recoveryCode} onChange={setRecoveryCode} disabled={isLoading} placeholder="Enter code from Gmail" />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full rounded-none"
                        onClick={() => setForgotStep("request")}
                        disabled={isLoading}
                      >
                        Change Email
                      </Button>
                      <SubmitButton isLoading={isLoading} loadingText="Verifying..." text="Verify Code" />
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleUpdatePassword} className="space-y-4">
                    <div>
                      <h3 className="text-xl font-bold">Set New Password</h3>
                      <p className="text-sm text-muted-foreground mt-1">Create your new password</p>
                    </div>
                    <PasswordField
                      label="New Password"
                      id="forgot-new-password"
                      value={newPassword}
                      onChange={setNewPassword}
                      disabled={isLoading}
                      showPassword={showNewPassword}
                      onToggleShow={() => setShowNewPassword((v) => !v)}
                    />
                    <PasswordField
                      label="Confirm Password"
                      id="forgot-confirm-password"
                      value={confirmPassword}
                      onChange={setConfirmPassword}
                      disabled={isLoading}
                      showPassword={showConfirmPassword}
                      onToggleShow={() => setShowConfirmPassword((v) => !v)}
                    />
                    <SubmitButton isLoading={isLoading} loadingText="Updating..." text="Reset Password" />
                  </form>
                )}
              </div>

            ) : (
              <>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold">Welcome back</h2>
                  <p className="text-sm text-muted-foreground mt-1">Sign in to your anime universe</p>
                </div>

                {/* Google */}
                <Button
                  variant="outline"
                  className="w-full mb-5 h-11 rounded-none flex items-center justify-center gap-2.5 border-primary/45 bg-card/40 hover:border-primary/70 hover:bg-primary/10 transition-all"
                  onClick={handleGoogleSignIn}
                  disabled={isGoogleLoading || isLoading}
                >
                  {isGoogleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                    <svg className="h-4 w-4" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                  )}
                  <span className="text-sm font-medium">Continue with Google</span>
                </Button>

                <div className="relative mb-5">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border/40" />
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase tracking-wider">
                    <span className="bg-transparent px-3 text-muted-foreground/60" style={{ backgroundColor: 'hsl(240 10% 10%)' }}>or continue with email</span>
                  </div>
                </div>

                <Tabs defaultValue="signin" className="w-full">
                  <TabsList className="w-full grid grid-cols-2 h-10 mb-5 bg-muted/50 border border-primary/35 rounded-none p-0.5">
                    <TabsTrigger value="signin" data-testid="tab-signin"
                      className="rounded-none text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-black data-[state=active]:shadow-neon transition-all">
                      Sign In
                    </TabsTrigger>
                    <TabsTrigger value="signup" data-testid="tab-signup"
                      className="rounded-none text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-black data-[state=active]:shadow-neon transition-all">
                      Sign Up
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="signin">
                    <form onSubmit={handleSignIn} className="space-y-4">
                      <FormField label="Email" id="signin-email" type="email" value={email} onChange={setEmail} disabled={isLoading} placeholder="your@email.com" testId="input-signin-email" />
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="signin-password" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Password</Label>
                          <button type="button" onClick={() => setShowForgotPassword(true)}
                            className="text-xs text-primary/70 hover:text-primary transition-colors">
                            Forgot?
                          </button>
                        </div>
                        <div className="relative">
                          <Input id="signin-password" data-testid="input-signin-password" type={showSignInPassword ? "text" : "password"} placeholder="••••••••"
                            value={password} onChange={(e) => setPassword(e.target.value)} required disabled={isLoading}
                            className="h-11 bg-muted/40 border-border/50 focus:border-primary/50 rounded-xl pr-10" />
                          <button
                            type="button"
                            onClick={() => setShowSignInPassword((v) => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-foreground transition-colors"
                            aria-label={showSignInPassword ? "Hide password" : "Show password"}
                          >
                            {showSignInPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                      <SubmitButton isLoading={isLoading} loadingText="Signing in..." text="Sign In" testId="button-signin" />
                    </form>
                  </TabsContent>

                  <TabsContent value="signup">
                    <form onSubmit={handleSignUp} className="space-y-4">
                      <FormField label="Username" id="signup-username" type="text" value={username} onChange={setUsername} disabled={isLoading} placeholder="YourUsername" testId="input-signup-username" />
                      <FormField label="Email" id="signup-email" type="email" value={email} onChange={setEmail} disabled={isLoading} placeholder="your@email.com" testId="input-signup-email" />
                      <FormField label="Password" id="signup-password" type="password" value={password} onChange={setPassword} disabled={isLoading} placeholder="••••••••" minLength={6} testId="input-signup-password" />
                      <SubmitButton isLoading={isLoading} loadingText="Creating account..." text="Create Account" testId="button-signup" />
                    </form>
                  </TabsContent>
                </Tabs>
              </>
            )}
          </div>

          <p className="text-center text-xs text-muted-foreground/40 mt-6">
            © 2026 AniCircle · Built for anime lovers
          </p>
        </div>
      </div>
    </div>
  );
};

const FormField = ({
  label, id, type, value, onChange, disabled, placeholder, minLength, testId
}: {
  label: string; id: string; type: string; value: string;
  onChange: (v: string) => void; disabled: boolean; placeholder?: string;
  minLength?: number; testId?: string;
}) => (
  <div className="space-y-1.5">
    <Label htmlFor={id} className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</Label>
    <Input id={id} data-testid={testId} type={type} placeholder={placeholder} value={value}
      onChange={(e) => onChange(e.target.value)} required disabled={disabled} minLength={minLength}
      className="h-11 bg-muted/40 border-border/50 focus:border-primary/50 rounded-xl" />
  </div>
);

const PasswordField = ({
  label, id, value, onChange, disabled, showPassword, onToggleShow,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  showPassword: boolean;
  onToggleShow: () => void;
}) => (
  <div className="space-y-1.5">
    <Label htmlFor={id} className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</Label>
    <div className="relative">
      <Input
        id={id}
        type={showPassword ? "text" : "password"}
        placeholder="••••••••"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        disabled={disabled}
        minLength={6}
        className="h-11 bg-muted/40 border-border/50 focus:border-primary/50 rounded-xl pr-10"
      />
      <button
        type="button"
        onClick={onToggleShow}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-foreground transition-colors"
        aria-label={showPassword ? "Hide password" : "Show password"}
      >
        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  </div>
);

const SubmitButton = ({ isLoading, loadingText, text, testId }: {
  isLoading: boolean; loadingText: string; text: string; testId?: string;
}) => (
  <Button type="submit" data-testid={testId} disabled={isLoading}
    className="w-full h-11 gradient-primary hover:opacity-90 transition-all shadow-neon rounded-xl font-semibold text-sm mt-1">
    {isLoading ? (
      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{loadingText}</>
    ) : text}
  </Button>
);

export default Auth;
