import { useLocation } from "react-router-dom";

const pageTitles: Record<string, string> = {
  "/": "Home",
  "/editor": "SQL Editor",
  "/upload": "Upload Data",
};

function TopBar() {
  const location = useLocation();

  const title =
    pageTitles[location.pathname] ??
    (location.pathname.startsWith("/dashboard") ? "Dashboard" : "find.bi");

  return (
    <header className="flex items-center h-14 px-4 bg-white border-b border-gray-200">
      <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
    </header>
  );
}

export default TopBar;
