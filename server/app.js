import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getDatabase } from "./database.js";
import {
  authenticate,
  hashPassword,
  verifyPassword,
  createSession,
  publicUser,
  checkAuthLimit,
  cookieValue,
  digest,
} from "./auth.js";
import {
  credentials,
  registerSchema,
  userSchema,
  initialState,
  snapshot,
  applyAction,
  fail,
  event,
} from "./domain.js";

export function createApp(database) {
  const app = express();
  app.disable("x-powered-by");
  if (process.env.VERCEL) app.set("trust proxy", 1);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            "https://fonts.googleapis.com",
          ],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:"],
          connectSrc: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use("/api", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.use(
    "/api",
    rateLimit({
      windowMs: 60000,
      limit: 300,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );
  app.use(express.json({ limit: "32kb" }));
  app.use("/api", async (req, res, next) => {
    try {
      // State-changing requests require same-origin browser context. Session endpoints also use CSRF tokens.
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
        if (!req.is("application/json")) fail(415, "Use application/json");
        const origin = req.get("origin");
        if (origin) {
          let url;
          try {
            url = new URL(origin);
          } catch {
            fail(403, "Invalid origin");
          }
          if (url.host !== req.get("host"))
            fail(403, "Cross-origin request rejected");
        }
        if (req.get("sec-fetch-site") === "cross-site")
          fail(403, "Cross-origin request rejected");
      }
      req.db = database || (await getDatabase());
      await req.db.init();
      next();
    } catch (e) {
      next(e);
    }
  });
  app.get("/api/health", (_req, res) =>
    res.json({ ok: true, service: "ParkFlow API", storage: "PostgreSQL" }),
  );
  app.post("/api/auth/register", async (req, res) => {
    const x = registerSchema.parse(req.body);
    if (!(await checkAuthLimit(req.db, `register:${req.ip}`)))
      fail(429, "Too many attempts. Try again in 15 minutes.");
    const password = await hashPassword(x.password),
      uid = randomUUID(),
      oid = randomUUID();
    try {
      await req.db.transaction(async (tx) => {
        await tx.query("INSERT INTO organizations(id,name) VALUES($1,$2)", [
          oid,
          x.organization,
        ]);
        await tx.query(
          "INSERT INTO users(id,organization_id,email,name,password_hash,role) VALUES($1,$2,$3,$4,$5,$6)",
          [uid, oid, x.email, x.name, password, "admin"],
        );
        const data = initialState(x.organization);
        event(
          data,
          { id: uid, name: x.name },
          "Organization workspace created",
        );
        await tx.query(
          "INSERT INTO parking_state(organization_id,data) VALUES($1,$2)",
          [oid, JSON.stringify(data)],
        );
      });
    } catch (e) {
      if (e.code === "23505")
        fail(409, "An account already exists with this email");
      throw e;
    }
    const csrf = await createSession(req.db, uid, res);
    res
      .status(201)
      .json({
        user: { id: uid, name: x.name, email: x.email, role: "admin" },
        csrf,
      });
  });
  app.post("/api/auth/login", async (req, res) => {
    const x = credentials.parse(req.body);
    if (
      !(await checkAuthLimit(req.db, `login-ip:${req.ip}`)) ||
      !(await checkAuthLimit(req.db, `login:${req.ip}:${x.email}`))
    )
      fail(429, "Too many attempts. Try again in 15 minutes.");
    const { rows } = await req.db.query("SELECT * FROM users WHERE email=$1", [
      x.email,
    ]);
    // Always run password hashing to reduce account-enumeration timing differences.
    const dummy = "00000000000000000000000000000000:" + "00".repeat(64);
    const valid = await verifyPassword(
      x.password,
      rows[0]?.password_hash || dummy,
    );
    if (!rows[0] || !valid) fail(401, "Email or password is incorrect");
    const csrf = await createSession(req.db, rows[0].id, res);
    res.json({ user: publicUser(rows[0]), csrf });
  });
  app.use("/api", async (req, _res, next) => {
    try {
      req.user = await authenticate(req.db, req);
      if (!req.user) fail(401, "Sign in to continue");
      if (
        !["GET", "HEAD"].includes(req.method) &&
        req.get("x-csrf-token") !== req.user.csrf_token
      )
        fail(403, "Session verification failed. Refresh and try again.");
      next();
    } catch (e) {
      next(e);
    }
  });
  app.get("/api/auth/me", (req, res) =>
    res.json({ user: publicUser(req.user), csrf: req.user.csrf_token }),
  );
  app.post("/api/auth/logout", async (req, res) => {
    await req.db.query("DELETE FROM auth_sessions WHERE token_hash=$1", [
      digest(cookieValue(req)),
    ]);
    res.clearCookie("pf-session", { path: "/" });
    res.json({ ok: true });
  });
  app.post("/api/auth/password", async (req, res) => {
    const x = z
      .object({
        current: z.string().min(1).max(128),
        password: z.string().min(12).max(128),
      })
      .parse(req.body);
    if (!(await checkAuthLimit(req.db, `password:${req.user.id}`)))
      fail(429, "Too many attempts");
    const { rows } = await req.db.query(
      "SELECT password_hash FROM users WHERE id=$1",
      [req.user.id],
    );
    if (!(await verifyPassword(x.current, rows[0].password_hash)))
      fail(400, "Current password is incorrect");
    await req.db.transaction(async (tx) => {
      await tx.query("UPDATE users SET password_hash=$1 WHERE id=$2", [
        await hashPassword(x.password),
        req.user.id,
      ]);
      await tx.query("DELETE FROM auth_sessions WHERE user_id=$1", [
        req.user.id,
      ]);
    });
    const csrf = await createSession(req.db, req.user.id, res);
    res.json({ ok: true, csrf });
  });
  async function stateTransaction(req, fn) {
    return req.db.transaction(async (tx) => {
      const { rows } = await tx.query(
        "SELECT data,revision FROM parking_state WHERE organization_id=$1 FOR UPDATE",
        [req.user.organization_id],
      );
      if (!rows[0]) fail(404, "Workspace not found");
      const data = rows[0].data;
      const before = JSON.stringify(data);
      const result = await fn(data);
      const view = snapshot(data);
      const changed = JSON.stringify(data) !== before;
      if (changed)
        await tx.query(
          "UPDATE parking_state SET data=$1,revision=revision+1 WHERE organization_id=$2",
          [JSON.stringify(data), req.user.organization_id],
        );
      return {
        result,
        state: view,
        revision: Number(rows[0].revision) + (changed ? 1 : 0),
      };
    });
  }
  app.get("/api/state", async (req, res) =>
    res.json(
      await stateTransaction(req, (data) => {
        snapshot(data);
        return null;
      }),
    ),
  );
  app.post("/api/actions", async (req, res) => {
    const x = z
      .object({
        type: z.string().max(30),
        data: z.record(z.string(), z.unknown()).default({}),
      })
      .parse(req.body);
    const result = await stateTransaction(req, (data) =>
      applyAction(data, req.user, x.type, x.data),
    );
    res.json(result);
  });
  app.get("/api/users", async (req, res) => {
    if (req.user.role !== "admin") fail(403, "Administrator access required");
    const { rows } = await req.db.query(
      "SELECT id,name,email,role,created_at FROM users WHERE organization_id=$1 ORDER BY created_at",
      [req.user.organization_id],
    );
    res.json({ users: rows });
  });
  app.post("/api/users", async (req, res) => {
    if (req.user.role !== "admin") fail(403, "Administrator access required");
    const x = userSchema.parse(req.body);
    const uid = randomUUID();
    try {
      await req.db.query(
        "INSERT INTO users(id,organization_id,email,name,password_hash,role) VALUES($1,$2,$3,$4,$5,$6)",
        [
          uid,
          req.user.organization_id,
          x.email,
          x.name,
          await hashPassword(x.password),
          x.role,
        ],
      );
    } catch (e) {
      if (e.code === "23505") fail(409, "This email already has an account");
      throw e;
    }
    res
      .status(201)
      .json({ user: { id: uid, name: x.name, email: x.email, role: x.role } });
  });
  app.delete("/api/users/:id", async (req, res) => {
    if (req.user.role !== "admin") fail(403, "Administrator access required");
    if (req.params.id === req.user.id)
      fail(400, "You cannot remove your own account");
    const { rows } = await req.db.query(
      "DELETE FROM users WHERE id=$1 AND organization_id=$2 RETURNING id",
      [req.params.id, req.user.organization_id],
    );
    if (!rows.length) fail(404, "Account not found");
    res.json({ ok: true });
  });
  app.use("/api", (_req, _res, next) =>
    next(Object.assign(new Error("Endpoint not found"), { status: 404 })),
  );
  app.use("/assets", express.static("assets", { maxAge: 0 }));
  app.get("/", (_req, res) =>
    res.sendFile("index.html", { root: process.cwd() }),
  );
  app.use((error, _req, res, _next) => {
    if (error instanceof z.ZodError)
      return res
        .status(400)
        .json({
          error: error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; "),
        });
    const status = error.status || 500;
    if (status >= 500)
      console.error("Request failed:", error.code || error.name, error.message);
    res
      .status(status)
      .json({
        error:
          status >= 500
            ? "The service is temporarily unavailable. Please try again."
            : error.message,
      });
  });
  return app;
}
export default createApp();
