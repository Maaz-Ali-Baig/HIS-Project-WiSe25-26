import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuthStore } from '../../../store/auth';
import { login } from '../api/auth';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../components/ui/card';
import { Checkbox } from '../../../components/ui/checkbox';
import { getToken } from '../../../lib/cookies';

const loginSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
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
      username: '',
      password: '',
      remember: false,
    },
  });

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: (data) => {
      const remember = watch('remember');
      authStore.login({
        token: data.accessToken,
        user: data.user,
        remember,
      });
      toast.success('Login successful!');
      navigate('/');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Login failed');
    },
  });

  const onSubmit = (data: LoginFormData) => {
    loginMutation.mutate({
      username: data.username,
      password: data.password,
    });
  };

  const rememberValue = watch('remember');

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
              Login
            </CardTitle>
            <CardDescription>
              Enter your credentials to access your account
            </CardDescription>
          </CardHeader>
          <CardContent className="px-8 pb-8">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your username"
                  {...register('username')}
                  aria-invalid={!!errors.username}
                  className="bg-[#F1F4FF] border-slate-200 rounded-xl"
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
                  {...register('password')}
                  aria-invalid={!!errors.password}
                  className="bg-[#F1F4FF] border-slate-200 rounded-xl"
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
                    setValue('remember', checked as boolean)
                  }
                />
                <Label
                  htmlFor="remember"
                  className="text-sm font-normal cursor-pointer"
                >
                  Remember me for 7 days
                </Label>
              </div>

              <Button
                type="submit"
                className="w-full rounded-xl bg-[#0F1C5A] hover:bg-[#111d4f]"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? 'Logging in...' : 'Login'}
              </Button>

              <div className="text-center text-sm text-gray-600">
                Don&apos;t have an account?{' '}
                <Link
                  to="/register"
                  className="text-blue-600 font-semibold hover:underline"
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
