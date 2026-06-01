import { Link, Outlet } from "react-router-dom";

export function Layout() {
  return (
    <div>
      <main style={{ padding: "1rem" }}>
        <Outlet />
      </main>
    </div>
  );
}
