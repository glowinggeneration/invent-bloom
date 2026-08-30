import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const WHATSAPP_NUMBER = "27746254639";
const SUPPORT_MESSAGE =
  "Hi Thabo, I need help with the CommsIQ platform. I am currently having an issue with:";

export function contactSupportUrl(context?: string) {
  const text = context?.trim() ? `${SUPPORT_MESSAGE} ${context.trim()}` : SUPPORT_MESSAGE;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

export function ContactSupportButton({
  context,
  variant = "outline",
  size = "sm",
  className,
}: {
  context?: string;
  variant?: "outline" | "default" | "ghost" | "secondary";
  size?: "sm" | "default" | "lg" | "icon";
  className?: string;
}) {
  return (
    <Button variant={variant} size={size} className={className} asChild>
      <a
        href={contactSupportUrl(context)}
        target="_blank"
        rel="noopener noreferrer"
        className="gap-2"
      >
        <MessageCircle className="size-4 shrink-0" />
        Chat with Thabo on WhatsApp
      </a>
    </Button>
  );
}
