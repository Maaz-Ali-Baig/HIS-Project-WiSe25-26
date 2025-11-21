import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useNavigate, Navigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { useAuthStore } from "../../../store/auth";
import { login } from "../api/auth";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Checkbox } from "../../../components/ui/checkbox";
import { getToken } from "../../../lib/cookies";

const loginSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  remember: z.boolean().optional().default(false),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const authStore = useAuthStore();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const token = getToken();

  // If already authenticated, redirect to home
  if (isAuthenticated || token) {
    return <Navigate to="/" replace />;
  }

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
      remember: false,
    },
  });

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: (data) => {
      const remember = watch("remember");
      authStore.login({
        token: data.accessToken,
        user: data.user,
        remember,
      });
      toast.success("Login successful!");
      navigate("/");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Login failed");
    },
  });

  const onSubmit = (data: LoginFormData) => {
    loginMutation.mutate({
      username: data.username,
      password: data.password,
    });
  };

  const rememberValue = watch("remember");

  return (
    <div className="min-h-screen w-full grid lg:grid-cols-2">
      {/* Left Column (Hero) */}
      <div className="bg-[linear-gradient(180deg,#3b5f9e_0%,#345ca8_100%)] flex flex-col items-center justify-center text-center text-white p-8 md:p-12 relative overflow-hidden">
        <div className="bg-white/10 backdrop-blur-sm p-6 rounded-3xl mb-8 shadow-lg">
          <img
            src="/university-logo.png"
            alt="University logo"
            className="h-16 w-auto mx-auto"
          />
        </div>
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold leading-tight max-w-md">
          Data Pre-Processing Platform for Qualitative Data Analysis
        </h1>
      </div>

      {/* Right Column (Form) */}
      <div className="flex items-center justify-center bg-[#f7f8fb] p-8">
        <Card className="w-full max-w-md border-none shadow-xl rounded-2xl p-6 bg-white">
          <CardHeader className="text-center space-y-2 pb-8">
            <CardTitle className="text-3xl font-bold text-gray-900">
              Login
            </CardTitle>
            <CardDescription className="text-gray-600 text-base">
              Enter your credentials to access your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your username"
                  {...register("username")}
                  aria-invalid={!!errors.username}
                  className="border-gray-200 rounded-lg h-11"
                />
                {errors.username && (
                  <p className="text-sm text-red-500">
                    {errors.username.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  {...register("password")}
                  aria-invalid={!!errors.password}
                  className="border-gray-200 rounded-lg h-11"
                />
                {errors.password && (
                  <p className="text-sm text-red-500">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="remember"
                  checked={rememberValue}
                  onCheckedChange={(checked) =>
                    setValue("remember", checked as boolean)
                  }
                />
                <Label
                  htmlFor="remember"
                  className="text-sm font-normal cursor-pointer text-gray-600"
                >
                  Remember me for 7 days
                </Label>
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-[#345ca8] hover:bg-[#2f5297] rounded-lg text-base font-bold"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? "Logging in..." : "Login"}
              </Button>

              <div className="text-center text-sm text-gray-600 pt-2">
                Don't have an account?{" "}
                <Link
                  to="/register"
                  className="text-[#345ca8] hover:underline font-medium"
                >
                  Register
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
