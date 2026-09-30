import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AuthForm } from "@/components/auth-form";

export default async function SignIn() {
  if (await auth.api.getSession({ headers: await headers() })) redirect("/");
  return <AuthForm mode="sign-in" />;
}
