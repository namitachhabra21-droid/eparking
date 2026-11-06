import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
const scrypt = promisify(scryptCallback);
export const digest = (value) =>
  createHash("sha256").update(value).digest("hex");
export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = await scrypt(password, salt, 64);
  return `${salt}:${hash.toString("hex")}`;
}
export async function verifyPassword(password, saved) {
  const [salt, hex] = saved.split(":");
  const candidate = await scrypt(password, salt, 64);
  const expected = Buffer.from(hex, "hex");
  return (
    expected.length === candidate.length && timingSafeEqual(expected, candidate)
  );
}
export function cookieValue(req) {
  return (
    req.headers.cookie
      ?.split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("pf-session="))
      ?.slice(11) || ""
  );
}
export function setSessionCookie(res, token) {
  res.cookie("pf-session", token, {
    httpOnly: true,
    secure: Boolean(
      process.env.VERCEL || process.env.NODE_ENV === "production",
    ),
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 86400000,
  });
}
export async function createSession(db, userId, res) {
  const token = randomBytes(32).toString("hex"),
    csrf = randomBytes(32).toString("hex");
  await db.query("DELETE FROM auth_sessions WHERE expires_at < now()");
  await db.query(
    "INSERT INTO auth_sessions(token_hash,user_id,csrf_token,expires_at) VALUES($1,$2,$3,$4)",
    [digest(token), userId, csrf, new Date(Date.now() + 7 * 86400000)],
  );
  setSessionCookie(res, token);
  return csrf;
}
export async function authenticate(db, req) {
  const token = cookieValue(req);
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const { rows } = await db.query(
    "SELECT u.id,u.organization_id,u.name,u.email,u.role,s.csrf_token FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()",
    [digest(token)],
  );
  return rows[0] || null;
}
export function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}
export async function checkAuthLimit(db, key) {
  const { rows } = await db.query(
    `INSERT INTO auth_limits(key,attempts,resets_at) VALUES($1,1,now()+interval '15 minutes')
    ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN auth_limits.resets_at<now() THEN 1 ELSE auth_limits.attempts+1 END,
    resets_at=CASE WHEN auth_limits.resets_at<now() THEN now()+interval '15 minutes' ELSE auth_limits.resets_at END RETURNING attempts`,
    [digest(key)],
  );
  return rows[0].attempts <= 20;
}
