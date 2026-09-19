import { cn } from "@/lib/utils";

interface Avatar {
  imageUrl: string;
  profileUrl?: string;
  alt?: string;
}

interface AvatarCirclesProps {
  className?: string;
  numPeople?: number;
  avatarUrls: Avatar[];
}

export function AvatarCircles({ numPeople, className, avatarUrls }: AvatarCirclesProps) {
  return (
    <div className={cn("z-10 flex -space-x-3 rtl:space-x-reverse", className)}>
      {avatarUrls.map((avatar, index) =>
        avatar.profileUrl ? (
          <a
            key={index}
            href={avatar.profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full ring-2 ring-background"
          >
            <img
              className="size-8 rounded-full object-cover"
              src={avatar.imageUrl}
              width={32}
              height={32}
              alt={avatar.alt ?? "Avatar"}
              loading="lazy"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
              }}
            />
          </a>
        ) : (
          <img
            key={index}
            className="size-8 rounded-full object-cover ring-2 ring-background"
            src={avatar.imageUrl}
            width={32}
            height={32}
            alt={avatar.alt ?? "Avatar"}
            loading="lazy"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
            }}
          />
        ),
      )}
      {numPeople ? (
        <div className="flex size-8 items-center justify-center rounded-full bg-muted text-center text-xs font-medium text-muted-foreground ring-2 ring-background">
          +{numPeople}
        </div>
      ) : null}
    </div>
  );
}
