import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { requestChannel } from "@/lib/channel-requests.functions";
import { friendlyError } from "@/lib/friendly-errors";

export function RequestChannelDialog() {
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState("");
  const [handle, setHandle] = useState("");
  const [notes, setNotes] = useState("");
  const submit = useServerFn(requestChannel);

  const mutation = useMutation({
    mutationFn: (data: { channel: string; handle: string; notes: string }) =>
      submit({ data }),
    onSuccess: () => {
      toast.success("Request sent. We will let you know once it is available.");
      setOpen(false);
      setChannel("");
      setHandle("");
      setNotes("");
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          Request another channel
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request another channel</DialogTitle>
          <DialogDescription>
            Tell us which platform you would like watched and we will look into adding it.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="request-channel">Channel</Label>
            <Input
              id="request-channel"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              placeholder="e.g. Threads, Telegram, a news site"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="request-handle">Page or link</Label>
            <Input
              id="request-handle"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="Optional — handle or web address"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="request-notes">Anything else?</Label>
            <Textarea
              id="request-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional — why this matters to your team"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={channel.trim().length < 2 || mutation.isPending}
            onClick={() =>
              mutation.mutate({ channel: channel.trim(), handle: handle.trim(), notes: notes.trim() })
            }
          >
            {mutation.isPending ? "Sending…" : "Send request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
