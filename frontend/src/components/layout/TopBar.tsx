import { useLocation } from "react-router-dom";
import VoiceStatusIndicator from "@/components/voice/VoiceStatusIndicator";

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
    <header className="flex items-center justify-between h-14 px-4 border-b border-[#2A2A2A] bg-[#141414]">
      <h2 className="text-sm font-semibold tracking-wide text-[#F0EDE4]">
        {title}
      </h2>
      <VoiceStatusIndicator />
    </header>
  );
}

export default TopBar;
