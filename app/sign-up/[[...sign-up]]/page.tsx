import { SignUp } from "@clerk/nextjs";

export const dynamic = "force-dynamic";

export default function SignUpPage() {
  return (
    <main className="auth-page">
      <SignUp routing="path" path="/sign-up" />
    </main>
  );
}
