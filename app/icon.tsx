import { ImageResponse } from "next/og";

// Favicon con la inicial del nombre comercial (desde NEXT_PUBLIC_APP_NAME) sobre
// el teal de la marca. Env-driven, consistente con el logotipo del header.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  const inicial = (process.env.NEXT_PUBLIC_APP_NAME ?? "TRACELINE")
    .charAt(0)
    .toUpperCase();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0E4F47",
          color: "#F7F3EA",
          fontSize: 22,
          fontWeight: 700,
          borderRadius: 7,
        }}
      >
        {inicial}
      </div>
    ),
    { ...size }
  );
}
