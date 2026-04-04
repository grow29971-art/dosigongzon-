import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: "C:\\Users\\acer\\city",
  },
  allowedDevOrigins: ["192.168.0.2", "localhost"],
};

export default nextConfig;
