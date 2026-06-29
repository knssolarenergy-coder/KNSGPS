import jwt from "jsonwebtoken";

export const JWT_SECRET = process.env.JWT_SECRET ?? "ks-solar-jwt-secret-2024";

export interface AuthPayload {
  userId: string;
  isAdmin: boolean;
  isTechnician?: boolean;
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}

export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, JWT_SECRET) as AuthPayload;
}
