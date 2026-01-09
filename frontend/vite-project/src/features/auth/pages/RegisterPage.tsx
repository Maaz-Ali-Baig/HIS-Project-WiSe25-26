import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useNavigate, Navigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { useAuthStore } from "../../../store/auth";
import { register as registerApi } from "../api/auth";
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

const registerSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .regex(
      /^[a-zA-Z0-9_]+$/,
      "Username can only contain letters, numbers, and underscores"
    ),
  password: z.string().min(8, "Password must be at least 8 characters"),
  remember: z.boolean().default(false),
});

type RegisterFormData = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const navigate = useNavigate();
  const authStore = useAuthStore();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const token = getToken();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    setError,
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      password: "",
      remember: false,
    },
  });

  const registerMutation = useMutation({
    mutationFn: registerApi,
    onSuccess: (data) => {
      const remember = watch("remember");
      authStore.login({
        token: data.accessToken,
        user: data.user,
        remember,
      });
      toast.success("Registration successful!");
      navigate("/", { viewTransition: true, replace: true });
    },
    onError: (error: Error) => {
      // Check if it's a username already exists error
      if (error.message.includes("Username already exists")) {
        setError("username", {
          type: "manual",
          message: "Username already exists",
        });
      } else {
        // Show generic error as toast
        toast.error(error.message || "Registration failed");
      }
    },
  });

  const onSubmit = (data: RegisterFormData) => {
    registerMutation.mutate({
      username: data.username,
      password: data.password,
    });
  };

  const rememberValue = watch("remember");

  // If already authenticated, redirect to home
  if (isAuthenticated || token) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="w-full max-w-md">
      <Card className="w-full border-none shadow-xl rounded-2xl p-6 bg-white">
        <CardHeader className="text-center space-y-2 pb-8">
          <CardTitle className="text-3xl font-bold text-gray-900">
            Register
          </CardTitle>
          <CardDescription className="text-gray-600 text-base">
            Create a new account to get started
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
              disabled={registerMutation.isPending}
            >
              {registerMutation.isPending ? "Creating account..." : "Register"}
            </Button>

            <div className="text-center text-sm text-gray-600 pt-2">
              Already have an account?{" "}
              <Link
                to="/login"
                className="text-[#345ca8] hover:underline font-medium"
              >
                Login
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
