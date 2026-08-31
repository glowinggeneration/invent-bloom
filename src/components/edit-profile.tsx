"use client";
/** Edit-profile dialog: name, title, timezone and working hours in one form. */
import { useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TimezoneCombobox } from "@/components/core/timezone-combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type ProfileFormData = {
  fullName: string;
  title: string;
  timezone: string;
  workingHours: string;
};

export type EditProfileProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData: ProfileFormData;
  onSave: (data: ProfileFormData) => void | Promise<void>;
};

export function EditProfile({ open, onOpenChange, initialData, onSave }: EditProfileProps) {
  const [formData, setFormData] = useState<ProfileFormData>(initialData);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setFormData(initialData);
  }, [open, initialData]);

  const handleChange =
    (field: keyof ProfileFormData) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(formData);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit your profile</DialogTitle>
          <DialogDescription>
            Update how your name and availability appear across the workspace.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="edit-profile-name">Full name</Label>
            <Input
              id="edit-profile-name"
              value={formData.fullName}
              onChange={handleChange("fullName")}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-profile-title">Title</Label>
            <Input
              id="edit-profile-title"
              value={formData.title}
              onChange={handleChange("title")}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <TimezoneCombobox
                value={formData.timezone}
                onChange={(timezone) => setFormData((prev) => ({ ...prev, timezone }))}
                className="max-w-none"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-profile-hours">Working hours</Label>
              <Input
                id="edit-profile-hours"
                value={formData.workingHours}
                onChange={handleChange("workingHours")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
