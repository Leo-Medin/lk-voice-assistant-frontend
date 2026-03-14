/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/widget",
        headers: [
          {
            key: "Permissions-Policy",
            value: "microphone=*",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
