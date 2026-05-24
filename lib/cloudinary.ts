import crypto from "crypto";

type CloudinaryConnection = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
};

export function getCloudinaryConnection(): CloudinaryConnection {
  const cloudinaryUrl = process.env.CLOUDINARY_URL;

  if (!cloudinaryUrl) {
    throw new Error("CLOUDINARY_URL is not defined.");
  }

  const parsed = new URL(cloudinaryUrl);

  if (!parsed.hostname || !parsed.username || !parsed.password) {
    throw new Error("CLOUDINARY_URL is invalid.");
  }

  return {
    cloudName: parsed.hostname,
    apiKey: parsed.username,
    apiSecret: parsed.password,
  };
}

export function signCloudinaryParams(paramsToSign: Record<string, unknown>) {
  const { apiSecret } = getCloudinaryConnection();

  const signatureBase = Object.entries(paramsToSign)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${key}=${Array.isArray(value) ? value.join(",") : String(value)}`)
    .sort()
    .join("&");

  return crypto.createHash("sha1").update(`${signatureBase}${apiSecret}`).digest("hex");
}

