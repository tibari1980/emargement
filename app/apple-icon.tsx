import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

/**
 * Apple Touch Icon (180x180) for iOS Safari and home screen shortcuts.
 */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0F172A",
          borderRadius: "36px",
        }}
      >
        <svg
          width="120"
          height="120"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Eye outer contour */}
          <path
            d="M2.5 12C3.9 7.6 7.6 4.6 12 4.6C16.4 4.6 20.1 7.6 21.5 12C20.1 16.4 16.4 19.4 12 19.4C7.6 19.4 3.9 16.4 2.5 12Z"
            stroke="#FFFFFF"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Golden iris ring */}
          <circle cx="12" cy="12" r="4.2" stroke="#FACC15" strokeWidth="2.2" fill="none" />
          {/* Pupil */}
          <circle cx="12" cy="12" r="2.2" fill="#FFFFFF" />
          {/* Light reflection */}
          <circle cx="13.6" cy="10.4" r="0.8" fill="#0F172A" />
        </svg>
      </div>
    ),
    {
      ...size,
    }
  );
}
