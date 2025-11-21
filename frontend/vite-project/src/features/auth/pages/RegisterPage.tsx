import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

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

// NOTE: if your API function has a different name,
// just adjust this import line.
import { register as registerUser } from "../api/auth";

const registerSchema = z
  .object({
    username: z
      .string()
      .min(3, "Username must be at least 3 characters")
      .max(20, "Username must be at most 20 characters"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      password: "",
      confirmPassword: "",
    },
  });

  const registerMutation = useMutation({
    mutationFn: (data: { username: string; password: string }) =>
      registerUser(data),
    onSuccess: () => {
      toast.success("Account created successfully. You can now log in.");
      reset();
      navigate("/login");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Registration failed");
    },
  });

  const onSubmit = (data: RegisterFormData) => {
    registerMutation.mutate({
      username: data.username,
      password: data.password,
    });
  };

  return (
    <div className="flex min-h-screen bg-[#F4F6FB]">
      {/* LEFT PANEL */}
      <div className="hidden lg:flex w-[48%] items-center justify-center bg-gradient-to-tr from-[#0F1C5A] to-[#244BEE] text-white px-10 shadow-[inset_-4px_0_18px_rgba(0,0,0,0.25)]">
        <div className="flex flex-col items-center text-center max-w-xl space-y-8">
          <div className="bg-white px-10 py-8 rounded-3xl shadow-[0_12px_28px_rgba(0,0,0,0.25),0_0_40px_rgba(79,124,255,0.45)]">
            <img
              src="/logo.png"
              alt="Project Logo"
              className="h-28 object-contain"
            />
          </div>

          <h1 className="mt-4 text-3xl font-extrabold leading-snug max-w-md">
            Data Pre-Processing
            <br />
            Platform for Qualitative Data Analysis
          </h1>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="flex flex-1 items-center justify-center bg-[#F7F9FF] px-4">
        <Card className="w-full max-w-md rounded-3xl border border-slate-200 shadow-[0_12px_30px_rgba(0,0,0,0.15),0_20px_50px_rgba(0,0,0,0.05)]">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-extrabold text-[#0F1C5A]">
              Create an Account
            </CardTitle>
            <CardDescription>
              Register to start using the platform
            </CardDescription>
          </CardHeader>
          <CardContent className="px-8 pb-8">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Username */}
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Choose a username"
                  {...register("username")}
                  aria-invalid={!!errors.username}
                  className="bg-[#F1F4FF] border-slate-200 rounded-xl"
                />
                {errors.username && (
                  <p className="text-sm text-red-500">
                    {errors.username.message}
                  </p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Create a password"
                  {...register("password")}
                  aria-invalid={!!errors.password}
                  className="bg-[#F1F4FF] border-slate-200 rounded-xl"
                />
                {errors.password && (
                  <p className="text-sm text-red-500">
                    {errors.password.message}
                  </p>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Re-enter your password"
                  {...register("confirmPassword")}
                  aria-invalid={!!errors.confirmPassword}
                  className="bg-[#F1F4FF] border-slate-200 rounded-xl"
                />
                {errors.confirmPassword && (
                  <p className="text-sm text-red-500">
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full rounded-xl bg-[#0F1C5A] hover:bg-[#111d4f]"
                disabled={registerMutation.isPending}
              >
                {registerMutation.isPending ? "Creating account..." : "Register"}
              </Button>

              <div className="text-center text-sm text-gray-600">
                Already have an account?{" "}
                <Link
                  to="/login"
                  className="text-blue-600 font-semibold hover:underline"
                >
                  Login
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
