import { redirect } from "next/navigation";

// El portal es la raíz funcional; el middleware redirige a /login si no hay sesión.
export default function Home() {
  redirect("/portal");
}
