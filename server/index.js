import app from "./app.js";
const port = Number(process.env.PORT) || 5173;
app.listen(port, "127.0.0.1", () =>
  console.log(`ParkFlow running at http://localhost:${port}`),
);
