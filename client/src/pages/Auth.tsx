import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Mail, ArrowLeft, KeyRound, Star, Zap, Eye } from "lucide-react";

const Auth = () => {
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading, isRecoveryMode, login, register, resetPassword, updatePassword, clearRecoveryMode, loginWithGoogle } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (user && !isRecoveryMode) setLocation("/");
  }, [user, setLocation, isRecoveryMode]);

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
      setResetSent(true);
      toast.success("Reset email sent!");
    } catch (error: any) {
      toast.error(error.message || "Failed to send reset email");
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
      toast.success("Password updated!");
      clearRecoveryMode();
      setNewPassword(""); setConfirmPassword("");
      setLocation("/");
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
    <div className="min-h-screen flex overflow-hidden bg-background aurora-bg">

      {/* ── Floating orbs ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="orb orb-purple absolute w-96 h-96 -top-20 -left-20 animate-float" />
        <div className="orb orb-blue absolute w-80 h-80 bottom-0 right-0 animate-float-delayed" />
        <div className="orb orb-pink absolute w-64 h-64 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-float-slow" />

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(hsl(268 88% 62% / 0.5) 1px, transparent 1px),
                              linear-gradient(90deg, hsl(268 88% 62% / 0.5) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* ── Left panel (desktop only) ── */}
      <div className="hidden lg:flex lg:w-[52%] relative flex-col items-center justify-center p-12 overflow-hidden">

        {/* Decorative circles */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full border border-primary/8" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] h-[380px] rounded-full border border-primary/12" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[260px] h-[260px] rounded-full border border-primary/20" />
          {/* Orbiting dot */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] h-[380px]">
            <div className="animate-orbit absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary shadow-neon" />
          </div>
        </div>

        {/* Content */}
        <div className="relative z-10 text-center space-y-8 max-w-md">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl animate-glow-pulse" />
              <img src="/logo.png" alt="AniCircle" className="relative h-24 w-24 rounded-full shadow-neon animate-neon-flicker" />
            </div>
            <div>
              <h1 className="text-6xl font-black text-gradient mb-2">AniCircle</h1>
              <p className="text-lg text-muted-foreground font-light tracking-wide">
                Your anime universe, organized.
              </p>
            </div>
          </div>

          {/* Feature pills */}
          <div className="flex flex-col gap-3">
            {[
              { icon: Eye, label: "Track every episode with real-time progress" },
              { icon: Zap, label: "Radar — never miss a sequel or new season" },
              { icon: Star, label: "Rate and rank your all-time favourites" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3 glass-light rounded-xl px-4 py-3 border border-border/30 animate-fade-in">
                <div className="shrink-0 w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <span className="text-sm text-muted-foreground text-left">{label}</span>
              </div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground/50 tracking-widest uppercase">
            Built for anime lovers
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
          <div className="holo-glass rounded-2xl p-6 shadow-[0_24px_80px_-12px_hsl(268_88%_62%/0.25)] border-white/5 animate-scale-in">

            {isRecoveryMode ? (
              <div className="space-y-5">
                <div className="text-center">
                  <div className="w-14 h-14 bg-primary/15 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-primary/20">
                    <KeyRound className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold">Set New Password</h3>
                  <p className="text-sm text-muted-foreground mt-1">Enter your new password below</p>
                </div>
                <form onSubmit={handleUpdatePassword} className="space-y-4">
                  <FormField label="New Password" id="new-password" type="password" value={newPassword} onChange={setNewPassword} disabled={isLoading} />
                  <FormField label="Confirm Password" id="confirm-password" type="password" value={confirmPassword} onChange={setConfirmPassword} disabled={isLoading} />
                  <SubmitButton isLoading={isLoading} loadingText="Updating..." text="Update Password" />
                </form>
              </div>

            ) : showForgotPassword ? (
              <div className="space-y-4">
                <button onClick={() => { setShowForgotPassword(false); setResetSent(false); setForgotEmail(""); }}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2">
                  <ArrowLeft className="h-4 w-4" /> Back to Sign In
                </button>

                {resetSent ? (
                  <div className="text-center space-y-4 py-4">
                    <div className="w-14 h-14 bg-primary/15 rounded-2xl flex items-center justify-center mx-auto border border-primary/20">
                      <Mail className="h-7 w-7 text-primary" />
                    </div>
                    <h3 className="text-xl font-bold">Check Your Email</h3>
                    <p className="text-sm text-muted-foreground">
                      Reset link sent to <span className="text-foreground font-medium">{forgotEmail}</span>
                    </p>
                    <Button variant="outline" onClick={() => { setShowForgotPassword(false); setResetSent(false); setForgotEmail(""); }} className="w-full">
                      Back to Sign In
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <div>
                      <h3 className="text-xl font-bold">Forgot Password?</h3>
                      <p className="text-sm text-muted-foreground mt-1">We'll send you a reset link</p>
                    </div>
                    <FormField label="Email" id="forgot-email" type="email" value={forgotEmail} onChange={setForgotEmail} disabled={isLoading} placeholder="your@email.com" />
                    <SubmitButton isLoading={isLoading} loadingText="Sending..." text="Send Reset Link" />
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
                  className="w-full mb-5 h-11 flex items-center justify-center gap-2.5 border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all"
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
                  <TabsList className="w-full grid grid-cols-2 h-10 mb-5 bg-muted/50 border border-border/30 rounded-xl p-0.5">
                    <TabsTrigger value="signin" data-testid="tab-signin"
                      className="rounded-[10px] text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-neon transition-all">
                      Sign In
                    </TabsTrigger>
                    <TabsTrigger value="signup" data-testid="tab-signup"
                      className="rounded-[10px] text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-neon transition-all">
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
                        <Input id="signin-password" data-testid="input-signin-password" type="password" placeholder="••••••••"
                          value={password} onChange={(e) => setPassword(e.target.value)} required disabled={isLoading}
                          className="h-11 bg-muted/40 border-border/50 focus:border-primary/50 rounded-xl" />
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
            © 2025 AniCircle · Built for anime lovers
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
