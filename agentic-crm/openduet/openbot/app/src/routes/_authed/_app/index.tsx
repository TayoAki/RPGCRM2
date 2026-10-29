import { createFileRoute, redirect } from "@tanstack/react-router";
import { ChatScreen } from "@/components/shell/chat-screen";
import { isDesktopWindow } from "@/hooks/use-desktop";

const TODAY_SHOWN_KEY = "magpie.today-shown";

// Once per visit: a desktop opens on Today, and Chat is a click away after that.
function firstDesktopVisit(): boolean {
  if (!isDesktopWindow()) return false;
  try {
    if (window.sessionStorage.getItem(TODAY_SHOWN_KEY)) return false;
    window.sessionStorage.setItem(TODAY_SHOWN_KEY, "1");
    return true;
  } catch {
    return false;
  }
}

/** Chat: the person's one ongoing conversation with the product's own Bot. */
export const Route = createFileRoute("/_authed/_app/")({
  beforeLoad: ({ preload }) => {
    if (!preload && firstDesktopVisit()) throw redirect({ to: "/today" });
  },
  component: ChatScreen,
});
